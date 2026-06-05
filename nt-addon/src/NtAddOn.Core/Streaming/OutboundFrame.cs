using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// An encoded outbound message ready to hand to
    /// <see cref="IWebSocketClient.SendAsync"/>: the frame bytes plus the frame
    /// kind (text vs binary). Produced by
    /// <see cref="OutboundPayloadEncoder.Encode"/>.
    /// </summary>
    public readonly struct OutboundFrame
    {
        /// <summary>The frame payload bytes.</summary>
        public ArraySegment<byte> Payload { get; }

        /// <summary>
        /// Whether the payload is a UTF-8 text frame (raw JSON) or a binary
        /// frame (e.g. GZip-compressed JSON).
        /// </summary>
        public WebSocketMessageKind Kind { get; }

        /// <summary>Creates an outbound frame.</summary>
        public OutboundFrame(ArraySegment<byte> payload, WebSocketMessageKind kind)
        {
            Payload = payload;
            Kind = kind;
        }
    }
}
