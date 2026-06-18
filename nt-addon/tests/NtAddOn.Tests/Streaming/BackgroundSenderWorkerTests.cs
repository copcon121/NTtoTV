using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using NtAddOn.Core.Buffering;
using NtAddOn.Core.MarketData;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    public class BackgroundSenderWorkerTests
    {
        [Fact]
        public async Task RunSenderLoop_DequeuesSerializesAndSendsOffCallerThread()
        {
            var callerThread = Thread.CurrentThread.ManagedThreadId;
            var queue = NewQueue();
            var socket = new RecordingWebSocketClient();
            var logger = new RecordingWorkerLogger();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            socket.AfterSuccessfulSend = () => cts.Cancel();
            queue.Enqueue(Trade(sequence: 7));

            var worker = new BackgroundSenderWorker(
                queue,
                socket,
                new Uri("ws://127.0.0.1:8000/ws/nt"),
                logger: logger);

            await worker.RunSenderLoopAsync(cts.Token);

            Assert.Equal(1, socket.ConnectCalls);
            Assert.Single(socket.Sends);
            Assert.Equal(WebSocketMessageKind.Text, socket.Sends[0].Kind);
            Assert.Contains("\"type\":\"trade\"", socket.Sends[0].Text);
            Assert.Contains("\"timeTicks\":638858610886080007", socket.Sends[0].Text);
            Assert.Contains("\"sequence\":7", socket.Sends[0].Text);
            Assert.NotEqual(callerThread, socket.Sends[0].ThreadId);
        }

        [Fact]
        public async Task RunSenderLoop_CompressionEnabled_SendsBinaryGzipFrame()
        {
            var queue = NewQueue();
            var socket = new RecordingWebSocketClient();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            socket.AfterSuccessfulSend = () => cts.Cancel();
            queue.Enqueue(Quote(sequence: 3));

            var worker = new BackgroundSenderWorker(
                queue,
                socket,
                new Uri("ws://127.0.0.1:8000/ws/nt"),
                encoder: new OutboundPayloadEncoder(compressionEnabled: true));

            await worker.RunSenderLoopAsync(cts.Token);

            Assert.Single(socket.Sends);
            Assert.Equal(WebSocketMessageKind.Binary, socket.Sends[0].Kind);
            Assert.Contains("\"type\":\"quote\"", Decompress(socket.Sends[0].Payload));
        }

        [Fact]
        public async Task RunSenderLoop_SendFailure_ReconnectsAndRetriesSameFrame()
        {
            var queue = NewQueue();
            var socket = new RecordingWebSocketClient { FailedSendsBeforeSuccess = 1 };
            var logger = new RecordingWorkerLogger();
            var statuses = new List<ConnectionStatus>();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            socket.AfterSuccessfulSend = () => cts.Cancel();
            queue.Enqueue(Trade(sequence: 11));

            var worker = new BackgroundSenderWorker(
                queue,
                socket,
                new Uri("ws://127.0.0.1:8000/ws/nt"),
                logger: logger,
                reportStatus: statuses.Add);

            await worker.RunSenderLoopAsync(cts.Token);

            Assert.Equal(2, socket.ConnectCalls);
            Assert.Equal(2, socket.SendAttempts);
            Assert.True(socket.CloseCalls >= 1);
            Assert.Single(socket.Sends);
            Assert.Contains("\"sequence\":11", socket.Sends[0].Text);
            Assert.Contains(logger.Errors, e => e.Message.Contains("reconnecting"));
            Assert.Contains(ConnectionStatus.Connected, statuses);
            Assert.Contains(ConnectionStatus.Disconnected, statuses);
        }

        [Fact]
        public async Task RunSenderLoop_SerializationFailure_LogsAndContinues()
        {
            var queue = NewQueue();
            var socket = new RecordingWebSocketClient();
            var logger = new RecordingWorkerLogger();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            socket.AfterSuccessfulSend = () => cts.Cancel();
            queue.Enqueue(Trade(sequence: 1));
            queue.Enqueue(Trade(sequence: 2));

            var worker = new BackgroundSenderWorker(
                queue,
                socket,
                new Uri("ws://127.0.0.1:8000/ws/nt"),
                serializer: new FailingFirstSerializer(),
                logger: logger);

            await worker.RunSenderLoopAsync(cts.Token);

            Assert.Single(socket.Sends);
            Assert.Contains("\"sequence\":2", socket.Sends[0].Text);
            Assert.Contains(logger.Errors, e => e.Message.Contains("event was skipped"));
        }

        private static BoundedQueue NewQueue()
        {
            return new BoundedQueue(
                capacity: 100,
                criticalOverloadThreshold: 100,
                droppedTradeLogger: new RecordingDroppedTradeLogger());
        }

        private static NormalizedTrade Trade(long sequence)
        {
            return new NormalizedTrade(
                symbol: "GC",
                contract: "GC 08-26",
                time: 1730313600000L + sequence,
                price: 2400.5,
                volume: 1,
                bid: 2400.4,
                ask: 2400.6,
                bestBid: 2400.4,
                bestAsk: 2400.6,
                sequence: sequence,
                timeTicks: 638858610886080000L + sequence);
        }

        private static NormalizedQuote Quote(long sequence)
        {
            return new NormalizedQuote(
                symbol: "GC",
                contract: "GC 08-26",
                time: 1730313600000L + sequence,
                bid: 2400.4,
                ask: 2400.6,
                bidSize: 10,
                askSize: 12,
                sequence: sequence);
        }

        private static string Decompress(byte[] payload)
        {
            using (var input = new MemoryStream(payload))
            using (var gzip = new GZipStream(input, CompressionMode.Decompress))
            using (var output = new MemoryStream())
            {
                gzip.CopyTo(output);
                return Encoding.UTF8.GetString(output.ToArray());
            }
        }

        private sealed class RecordingDroppedTradeLogger : IDroppedTradeLogger
        {
            public void LogDroppedTrade(StreamId stream, long sequence, long timestampMs)
            {
            }
        }

        private sealed class RecordingWorkerLogger : IWorkerLogger
        {
            public List<string> Infos { get; } = new List<string>();
            public List<(string Message, Exception? Exception)> Errors { get; } =
                new List<(string, Exception?)>();

            public void LogInfo(string message)
            {
                Infos.Add(message);
            }

            public void LogError(string message, Exception? exception)
            {
                Errors.Add((message, exception));
            }
        }

        private sealed class FailingFirstSerializer : INormalizedEventSerializer
        {
            private int _calls;

            public string Serialize(INormalizedEvent ev)
            {
                _calls++;
                if (_calls == 1)
                {
                    throw new InvalidOperationException("injected serializer failure");
                }

                return NormalizedEventJsonSerializer.Instance.Serialize(ev);
            }
        }

        private sealed class RecordingWebSocketClient : IWebSocketClient
        {
            private bool _connected;

            public int ConnectCalls { get; private set; }
            public int CloseCalls { get; private set; }
            public int SendAttempts { get; private set; }
            public int FailedSendsBeforeSuccess { get; set; }
            public Action? AfterSuccessfulSend { get; set; }
            public List<RecordedSend> Sends { get; } = new List<RecordedSend>();
            public bool IsConnected => _connected;

            public Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
            {
                ConnectCalls++;
                _connected = true;
                return Task.CompletedTask;
            }

            public Task SendAsync(
                ArraySegment<byte> payload,
                WebSocketMessageKind kind,
                CancellationToken cancellationToken)
            {
                SendAttempts++;
                if (!_connected)
                {
                    throw new InvalidOperationException("not connected");
                }

                if (FailedSendsBeforeSuccess > 0)
                {
                    FailedSendsBeforeSuccess--;
                    _connected = false;
                    throw new InvalidOperationException("injected send failure");
                }

                var bytes = Copy(payload);
                Sends.Add(new RecordedSend(
                    bytes,
                    kind,
                    kind == WebSocketMessageKind.Text ? Encoding.UTF8.GetString(bytes) : string.Empty,
                    Thread.CurrentThread.ManagedThreadId));

                AfterSuccessfulSend?.Invoke();
                return Task.CompletedTask;
            }

            public Task<WebSocketReceiveResultMessage> ReceiveAsync(CancellationToken cancellationToken)
            {
                throw new NotSupportedException();
            }

            public Task CloseAsync(CancellationToken cancellationToken)
            {
                CloseCalls++;
                _connected = false;
                return Task.CompletedTask;
            }

            public void Dispose()
            {
                _connected = false;
            }

            private static byte[] Copy(ArraySegment<byte> segment)
            {
                var bytes = new byte[segment.Count];
                Array.Copy(segment.Array!, segment.Offset, bytes, 0, segment.Count);
                return bytes;
            }
        }

        private readonly struct RecordedSend
        {
            public RecordedSend(byte[] payload, WebSocketMessageKind kind, string text, int threadId)
            {
                Payload = payload;
                Kind = kind;
                Text = text;
                ThreadId = threadId;
            }

            public byte[] Payload { get; }
            public WebSocketMessageKind Kind { get; }
            public string Text { get; }
            public int ThreadId { get; }
        }
    }
}
