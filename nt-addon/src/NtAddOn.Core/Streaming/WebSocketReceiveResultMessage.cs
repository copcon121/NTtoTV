using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// A single inbound message received over an <see cref="IWebSocketClient"/>.
    /// Returned by <see cref="IWebSocketClient.ReceiveAsync"/> and consumed by
    /// the control-plane receive loop (task 4.10), which parses
    /// <see cref="Text"/> as a Control_Command JSON message.
    ///
    /// <para>This is part of the shared transport seam (not used by the sender
    /// worker in task 4.7) so the control plane can read from the same single
    /// connection the worker writes to.</para>
    /// </summary>
    public readonly struct WebSocketReceiveResultMessage
    {
        /// <summary>
        /// The decoded message text. For a <see cref="WebSocketMessageKind.Text"/>
        /// frame this is the UTF-8 JSON; for a <see cref="WebSocketMessageKind.Binary"/>
        /// frame the transport implementation is responsible for decompressing
        /// (if applicable) and decoding before populating this field.
        /// </summary>
        public string Text { get; }

        /// <summary>The frame kind that was received.</summary>
        public WebSocketMessageKind Kind { get; }

        /// <summary>
        /// True when the server has signalled a graceful close. When true,
        /// <see cref="Text"/> is empty and the control-plane loop should treat
        /// the connection as closed (handing off to the reconnect loop).
        /// </summary>
        public bool IsCloseFrame { get; }

        /// <summary>
        /// Creates a received-message result.
        /// </summary>
        public WebSocketReceiveResultMessage(string text, WebSocketMessageKind kind, bool isCloseFrame = false)
        {
            Text = text ?? string.Empty;
            Kind = kind;
            IsCloseFrame = isCloseFrame;
        }

        /// <summary>A close-frame sentinel result.</summary>
        public static WebSocketReceiveResultMessage Close() =>
            new WebSocketReceiveResultMessage(string.Empty, WebSocketMessageKind.Text, isCloseFrame: true);
    }
}
