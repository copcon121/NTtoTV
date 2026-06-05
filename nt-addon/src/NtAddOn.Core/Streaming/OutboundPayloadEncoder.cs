using System;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Turns a serialized JSON message into the bytes + frame kind to put on the
    /// wire, applying optional GZip compression (Req 2.2). This is the
    /// "(compress)" step of the sender pipeline (design: dequeue → serialize →
    /// (compress) → send) and runs only on the background worker, never on the
    /// NinjaTrader callback path (Req 2.1–2.3).
    ///
    /// <para>When compression is disabled the message is sent as a UTF-8
    /// <see cref="WebSocketMessageKind.Text"/> frame whose bytes are exactly the
    /// documented JSON. When enabled the same UTF-8 JSON is GZip-compressed and
    /// sent as a <see cref="WebSocketMessageKind.Binary"/> frame, so the frame
    /// kind itself tells the Backend how to decode the payload.</para>
    /// </summary>
    public sealed class OutboundPayloadEncoder
    {
        /// <summary>
        /// A shared encoder with compression disabled (raw UTF-8 JSON text
        /// frames). Matches <see cref="NtAddOn.Core.Configuration.AddOnConfig"/>
        /// defaults where <c>CompressionEnabled = false</c>.
        /// </summary>
        public static readonly OutboundPayloadEncoder Uncompressed =
            new OutboundPayloadEncoder(compressionEnabled: false);

        // UTF-8 without a BOM so the JSON bytes start exactly at '{'.
        private static readonly UTF8Encoding Utf8NoBom =
            new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false);

        /// <summary>
        /// Whether payloads are GZip-compressed before transmission (Req 2.2).
        /// </summary>
        public bool CompressionEnabled { get; }

        /// <summary>
        /// Creates an encoder with the given compression setting (typically
        /// <see cref="NtAddOn.Core.Configuration.AddOnConfig.CompressionEnabled"/>).
        /// </summary>
        public OutboundPayloadEncoder(bool compressionEnabled)
        {
            CompressionEnabled = compressionEnabled;
        }

        /// <summary>
        /// Encodes <paramref name="json"/> into a frame for
        /// <see cref="IWebSocketClient.SendAsync"/>: a UTF-8 text frame when
        /// compression is disabled, or a GZip-compressed binary frame when
        /// enabled.
        /// </summary>
        /// <param name="json">The serialized JSON message.</param>
        /// <returns>The frame bytes and the frame kind to send.</returns>
        public OutboundFrame Encode(string json)
        {
            if (json == null)
            {
                throw new ArgumentNullException(nameof(json));
            }

            var utf8 = Utf8NoBom.GetBytes(json);

            if (!CompressionEnabled)
            {
                return new OutboundFrame(
                    new ArraySegment<byte>(utf8), WebSocketMessageKind.Text);
            }

            var compressed = GzipCompress(utf8);
            return new OutboundFrame(
                new ArraySegment<byte>(compressed), WebSocketMessageKind.Binary);
        }

        private static byte[] GzipCompress(byte[] data)
        {
            using (var output = new MemoryStream())
            {
                // Leave the underlying stream open so we can read the buffer
                // after the GZip stream flushes/closes its trailer.
                using (var gzip = new GZipStream(output, CompressionMode.Compress, leaveOpen: true))
                {
                    gzip.Write(data, 0, data.Length);
                }

                return output.ToArray();
            }
        }
    }
}
