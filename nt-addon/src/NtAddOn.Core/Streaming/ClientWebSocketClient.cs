using System;
using System.IO;
using System.IO.Compression;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Production <see cref="IWebSocketClient"/> implementation backed by
    /// <see cref="ClientWebSocket"/>.
    /// </summary>
    public sealed class ClientWebSocketClient : IWebSocketClient
    {
        private const int ReceiveBufferSize = 8192;
        private readonly object _gate = new object();

        private ClientWebSocket _client = new ClientWebSocket();
        private bool _disposed;

        /// <inheritdoc />
        public bool IsConnected
        {
            get
            {
                lock (_gate)
                {
                    return !_disposed && _client.State == WebSocketState.Open;
                }
            }
        }

        /// <inheritdoc />
        public async Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
        {
            if (uri == null)
            {
                throw new ArgumentNullException(nameof(uri));
            }

            ClientWebSocket client;
            lock (_gate)
            {
                ThrowIfDisposed();
                if (_client.State != WebSocketState.None)
                {
                    _client.Dispose();
                    _client = new ClientWebSocket();
                }

                client = _client;
            }

            await client.ConnectAsync(uri, cancellationToken).ConfigureAwait(false);
        }

        /// <inheritdoc />
        public Task SendAsync(
            ArraySegment<byte> payload,
            WebSocketMessageKind kind,
            CancellationToken cancellationToken)
        {
            ClientWebSocket client;
            lock (_gate)
            {
                ThrowIfDisposed();
                client = _client;
            }

            var messageType = kind == WebSocketMessageKind.Binary
                ? WebSocketMessageType.Binary
                : WebSocketMessageType.Text;

            return client.SendAsync(payload, messageType, endOfMessage: true, cancellationToken);
        }

        /// <inheritdoc />
        public async Task<WebSocketReceiveResultMessage> ReceiveAsync(CancellationToken cancellationToken)
        {
            ClientWebSocket client;
            lock (_gate)
            {
                ThrowIfDisposed();
                client = _client;
            }

            var buffer = new byte[ReceiveBufferSize];
            using (var message = new MemoryStream())
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await client.ReceiveAsync(
                        new ArraySegment<byte>(buffer),
                        cancellationToken).ConfigureAwait(false);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return WebSocketReceiveResultMessage.Close();
                    }

                    if (result.Count > 0)
                    {
                        message.Write(buffer, 0, result.Count);
                    }
                }
                while (!result.EndOfMessage);

                var kind = result.MessageType == WebSocketMessageType.Binary
                    ? WebSocketMessageKind.Binary
                    : WebSocketMessageKind.Text;
                var bytes = message.ToArray();
                var text = DecodeMessage(bytes, kind);
                return new WebSocketReceiveResultMessage(text, kind);
            }
        }

        /// <inheritdoc />
        public async Task CloseAsync(CancellationToken cancellationToken)
        {
            ClientWebSocket client;
            lock (_gate)
            {
                if (_disposed)
                {
                    return;
                }

                client = _client;
            }

            if (client.State == WebSocketState.Open ||
                client.State == WebSocketState.CloseReceived)
            {
                await client.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "closed",
                    cancellationToken).ConfigureAwait(false);
            }
        }

        /// <inheritdoc />
        public void Dispose()
        {
            lock (_gate)
            {
                if (_disposed)
                {
                    return;
                }

                _disposed = true;
                _client.Dispose();
            }
        }

        private static string DecodeMessage(byte[] bytes, WebSocketMessageKind kind)
        {
            if (kind == WebSocketMessageKind.Binary && LooksLikeGzip(bytes))
            {
                using (var input = new MemoryStream(bytes))
                using (var gzip = new GZipStream(input, CompressionMode.Decompress))
                using (var output = new MemoryStream())
                {
                    gzip.CopyTo(output);
                    bytes = output.ToArray();
                }
            }

            return Encoding.UTF8.GetString(bytes);
        }

        private static bool LooksLikeGzip(byte[] bytes)
        {
            return bytes.Length >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b;
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(ClientWebSocketClient));
            }
        }
    }
}
