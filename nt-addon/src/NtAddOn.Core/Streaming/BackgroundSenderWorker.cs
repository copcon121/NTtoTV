using System;
using System.Threading;
using System.Threading.Tasks;
using NtAddOn.Core.Buffering;
using NtAddOn.Core.Configuration;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Background consumer for the NT_AddOn outbound data path (task 4.7).
    /// It is the only component that dequeues market-data events and performs
    /// JSON serialization, optional compression, and WebSocket transmission.
    /// </summary>
    public sealed class BackgroundSenderWorker
    {
        private readonly BoundedQueue _queue;
        private readonly IWebSocketClient _socket;
        private readonly Uri _backendUri;
        private readonly INormalizedEventSerializer _serializer;
        private readonly OutboundPayloadEncoder _encoder;
        private readonly ReconnectLoop _reconnectLoop;
        private readonly IWorkerLogger _logger;
        private readonly Action<ConnectionStatus>? _reportStatus;

        /// <summary>
        /// Creates a worker from AddOn configuration. The backend URI and
        /// compression setting are derived from <paramref name="config"/>.
        /// </summary>
        public BackgroundSenderWorker(
            BoundedQueue queue,
            IWebSocketClient socket,
            AddOnConfig config,
            INormalizedEventSerializer? serializer = null,
            OutboundPayloadEncoder? encoder = null,
            ReconnectLoop? reconnectLoop = null,
            IWorkerLogger? logger = null,
            Action<ConnectionStatus>? reportStatus = null)
            : this(
                queue,
                socket,
                (config ?? throw new ArgumentNullException(nameof(config))).BuildBackendUri(),
                serializer,
                encoder ?? new OutboundPayloadEncoder(config.CompressionEnabled),
                reconnectLoop,
                logger,
                reportStatus)
        {
        }

        /// <summary>
        /// Creates a worker with explicit transport and encoding collaborators.
        /// </summary>
        public BackgroundSenderWorker(
            BoundedQueue queue,
            IWebSocketClient socket,
            Uri backendUri,
            INormalizedEventSerializer? serializer = null,
            OutboundPayloadEncoder? encoder = null,
            ReconnectLoop? reconnectLoop = null,
            IWorkerLogger? logger = null,
            Action<ConnectionStatus>? reportStatus = null)
        {
            _queue = queue ?? throw new ArgumentNullException(nameof(queue));
            _socket = socket ?? throw new ArgumentNullException(nameof(socket));
            _backendUri = backendUri ?? throw new ArgumentNullException(nameof(backendUri));
            _serializer = serializer ?? NormalizedEventJsonSerializer.Instance;
            _encoder = encoder ?? OutboundPayloadEncoder.Uncompressed;
            _reconnectLoop = reconnectLoop ?? new ReconnectLoop();
            _logger = logger ?? NoOpWorkerLogger.Instance;
            _reportStatus = reportStatus;
        }

        /// <summary>
        /// Starts the sender on a dedicated background task. The caller thread
        /// only schedules the worker; the blocking dequeue loop runs elsewhere.
        /// </summary>
        public Task RunSenderLoopAsync(CancellationToken cancellationToken)
        {
            return Task.Factory.StartNew(
                () => RunSenderLoopCoreAsync(cancellationToken),
                CancellationToken.None,
                TaskCreationOptions.LongRunning,
                TaskScheduler.Default).Unwrap();
        }

        private async Task RunSenderLoopCoreAsync(CancellationToken cancellationToken)
        {
            _logger.LogInfo("NT_AddOn background sender worker started.");

            try
            {
                while (true)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var ev = _queue.Dequeue(cancellationToken);
                    if (!TryBuildFrame(ev, out var frame))
                    {
                        continue;
                    }

                    await SendWithReconnectAsync(ev, frame, cancellationToken)
                        .ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInfo("NT_AddOn background sender worker stopped.");
            }
            finally
            {
                await CloseQuietlyAsync(CancellationToken.None).ConfigureAwait(false);
                ReportStatus(ConnectionStatus.Disconnected);
            }
        }

        private bool TryBuildFrame(INormalizedEvent ev, out OutboundFrame frame)
        {
            frame = default;

            try
            {
                var json = _serializer.Serialize(ev);
                frame = _encoder.Encode(json);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    $"Failed to serialize or encode outbound event {Describe(ev)}; event was skipped.",
                    ex);
                return false;
            }
        }

        private async Task SendWithReconnectAsync(
            INormalizedEvent ev,
            OutboundFrame frame,
            CancellationToken cancellationToken)
        {
            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await EnsureConnectedAsync(cancellationToken).ConfigureAwait(false);

                try
                {
                    await _socket.SendAsync(frame.Payload, frame.Kind, cancellationToken)
                        .ConfigureAwait(false);
                    return;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        $"Failed to send outbound event {Describe(ev)}; reconnecting and retrying.",
                        ex);
                    ReportStatus(ConnectionStatus.Disconnected);
                    await CloseQuietlyAsync(cancellationToken).ConfigureAwait(false);
                }
            }
        }

        private async Task EnsureConnectedAsync(CancellationToken cancellationToken)
        {
            if (_socket.IsConnected)
            {
                return;
            }

            await _reconnectLoop.RunReconnectLoopAsync(
                async ct =>
                {
                    await _socket.ConnectAsync(_backendUri, ct).ConfigureAwait(false);
                    if (!_socket.IsConnected)
                    {
                        throw new InvalidOperationException(
                            "WebSocket connect completed but the socket is not connected.");
                    }
                },
                cancellationToken).ConfigureAwait(false);

            _logger.LogInfo($"Connected NT_AddOn sender worker to {_backendUri}.");
            ReportStatus(ConnectionStatus.Connected);
        }

        private async Task CloseQuietlyAsync(CancellationToken cancellationToken)
        {
            try
            {
                await _socket.CloseAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to close the WebSocket connection cleanly.", ex);
            }
        }

        private void ReportStatus(ConnectionStatus status)
        {
            if (_reportStatus == null)
            {
                return;
            }

            try
            {
                _reportStatus(status);
            }
            catch (Exception ex)
            {
                _logger.LogError("Connection status callback failed.", ex);
            }
        }

        private static string Describe(INormalizedEvent ev)
        {
            return $"{ev.Stream} seq={ev.Sequence} time={ev.TimestampMs}";
        }
    }
}
