#if NT8
// Compiled ONLY when the NinjaTrader 8 assemblies are available
// (see NtAddOn.NinjaTrader.csproj). This is the live composition root that ties
// the NinjaTrader-coupled adapter to the fully-tested NtAddOn.Core components:
//
//   NinjaTrader Level 1 callbacks
//        -> MarketDataCallbackAdapter (normalize + tag contract)
//        -> MarketDataNormalizer (assign per-stream sequence)
//        -> BoundedQueue (backpressure: retain trades / coalesce quotes)
//        -> BackgroundSenderWorker (serialize + optional compress + send)
//        -> ClientWebSocketClient -> ws://host:port/ws/nt
//
//   plus a control-plane receive loop that applies inbound subscribe/unsubscribe
//   Control_Commands, and start-up subscription to every Candidate_Contract.
//
// All decision logic lives in NtAddOn.Core and is unit/property-tested; this
// file only wires the pieces and owns the NinjaTrader threads / task lifetimes.

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NtAddOn.Core.Buffering;
using NtAddOn.Core.Configuration;
using NtAddOn.Core.MarketData;
using NtAddOn.Core.Streaming;

namespace NtAddOn.NinjaTrader
{
    /// <summary>
    /// Owns the live NT_AddOn pipeline for a single user-facing symbol ("GC").
    /// Constructed and started by <see cref="GcDataBridgeAddOn"/> once the
    /// NinjaTrader session is connected.
    /// </summary>
    internal sealed class GcDataBridgeRuntime : IDisposable
    {
        private const string Symbol = "GC";

        private readonly AddOnConfig _config;
        private readonly Action<string> _log;

        private readonly BoundedQueue _queue;
        private readonly SequenceGenerator _sequencer;
        private readonly MarketDataCallbackAdapter _adapter;
        private readonly NinjaTraderContractSubscriber _subscriber;
        private readonly ControlPlane _controlPlane;
        private readonly ClientWebSocketClient _socket;
        private readonly BackgroundSenderWorker _worker;

        private CancellationTokenSource? _cts;
        private Task? _senderTask;
        private Task? _receiveTask;
        private bool _disposed;

        public GcDataBridgeRuntime(AddOnConfig config, Action<string> log)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _log = log ?? (_ => { });

            var logger = new NinjaScriptLogger(_log);

            // Producer side: sequence source + Bounded_Queue behind the normalizer.
            _sequencer = new SequenceGenerator();
            _queue = new BoundedQueue(_config, logger);
            _adapter = new MarketDataCallbackAdapter(
                Symbol,
                new SequenceSourceAdapter(_sequencer),
                new QueueEventSink(_queue));

            // Control plane: NinjaTrader subscribe/unsubscribe behind the seam.
            _subscriber = new NinjaTraderContractSubscriber(_adapter);
            _controlPlane = new ControlPlane(_subscriber);
            _controlPlane.StatusChanged += s => _log($"[GcDataBridge] connection status: {s}");

            // Consumer side: the single transport shared by the sender + receive
            // loop, driven by the background worker (with Fibonacci reconnect).
            _socket = new ClientWebSocketClient();
            _worker = new BackgroundSenderWorker(
                _queue,
                _socket,
                _config,
                logger: logger,
                reportStatus: s => _controlPlane.ReportStatus(s));
        }

        /// <summary>The contracts currently subscribed (Req 1.5, 1.7, 1.8).</summary>
        public System.Collections.Generic.IReadOnlyList<string> ActiveContracts =>
            _controlPlane.ActiveContracts;

        /// <summary>
        /// Starts the pipeline: launches the background sender (which connects +
        /// reconnects), the control-plane receive loop, and subscribes to every
        /// Candidate_Contract (Req 1.5).
        /// </summary>
        public void Start()
        {
            _cts = new CancellationTokenSource();
            var token = _cts.Token;

            _senderTask = _worker.RunSenderLoopAsync(token);
            _receiveTask = Task.Run(() => RunReceiveLoopAsync(token));

            // Subscribe to all configured candidates (or the manual override
            // only, when one is pinned — Req 10.4).
            if (_config.HasManualOverride)
            {
                _subscriber.Subscribe(_config.ManualContractOverride!);
                _log($"[GcDataBridge] manual override: charting {_config.ManualContractOverride}");
            }
            else
            {
                _controlPlane.Start(_config);
            }

            _log($"[GcDataBridge] started; forwarding to {_config.BuildBackendUri()}.");
        }

        private async Task RunReceiveLoopAsync(CancellationToken token)
        {
            // Apply inbound subscribe/unsubscribe Control_Commands (Req 1.7, 1.8).
            // The worker owns connection lifetime; we simply read when connected
            // and back off briefly otherwise so we never busy-spin.
            while (!token.IsCancellationRequested)
            {
                try
                {
                    if (!_socket.IsConnected)
                    {
                        await Task.Delay(250, token).ConfigureAwait(false);
                        continue;
                    }

                    var message = await _socket.ReceiveAsync(token).ConfigureAwait(false);
                    if (!string.IsNullOrEmpty(message.Text))
                    {
                        _controlPlane.OnControlMessage(message.Text);
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _log($"[GcDataBridge] receive loop error: {ex.Message}");
                    try
                    {
                        await Task.Delay(250, token).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                }
            }
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            try
            {
                _cts?.Cancel();
            }
            catch
            {
                // best effort
            }

            try
            {
                Task.WaitAll(
                    new[] { _senderTask, _receiveTask }
                        .Where(t => t != null)!.ToArray(),
                    TimeSpan.FromSeconds(2));
            }
            catch
            {
                // shutting down; ignore aggregate cancellation/timeout
            }

            _subscriber.Dispose();
            _socket.Dispose();
            _cts?.Dispose();
            _log("[GcDataBridge] stopped.");
        }

        // -- composition adapters (bridge Core seams to concrete components) --

        /// <summary>Adapts <see cref="SequenceGenerator"/> to <see cref="ISequenceSource"/>.</summary>
        private sealed class SequenceSourceAdapter : ISequenceSource
        {
            private readonly SequenceGenerator _generator;
            public SequenceSourceAdapter(SequenceGenerator generator) => _generator = generator;
            public long Next(StreamId stream) => _generator.NextSequence(stream);
        }

        /// <summary>Adapts <see cref="BoundedQueue"/> to <see cref="IEventSink"/>.</summary>
        private sealed class QueueEventSink : IEventSink
        {
            private readonly BoundedQueue _queue;
            public QueueEventSink(BoundedQueue queue) => _queue = queue;
            public bool Enqueue(NormalizedEvent ev) => _queue.Enqueue(ev);
        }

        /// <summary>
        /// Routes worker + dropped-trade logging to the AddOn's log sink (the
        /// NinjaScript Output window).
        /// </summary>
        private sealed class NinjaScriptLogger : IWorkerLogger, IDroppedTradeLogger
        {
            private readonly Action<string> _log;
            public NinjaScriptLogger(Action<string> log) => _log = log;

            public void LogInfo(string message) => _log("[GcDataBridge] " + message);

            public void LogError(string message, Exception? exception) =>
                _log("[GcDataBridge] ERROR: " + message +
                     (exception != null ? " :: " + exception.Message : string.Empty));

            public void LogDroppedTrade(StreamId stream, long sequence, long timestampMs) =>
                _log($"[GcDataBridge] dropped trade {stream} seq={sequence} time={timestampMs}");
        }
    }
}
#endif
