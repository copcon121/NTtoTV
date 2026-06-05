using System;
using System.Threading;
using System.Threading.Tasks;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Transport seam for the NT_AddOn's outbound WebSocket client connection to
    /// the Backend at <c>ws://127.0.0.1:&lt;port&gt;/ws/nt</c> (Req 1.4). This
    /// abstraction lets the background sender worker (task 4.7), the reconnect
    /// loop (task 4.8), and the control-command/status path (task 4.10) be
    /// developed and tested independently of any concrete socket implementation,
    /// and lets all three share a single transport instance.
    ///
    /// <para><b>Why an interface.</b> NinjaTrader 8 runs on .NET Framework 4.8,
    /// where the concrete transport is a <c>System.Net.WebSockets.ClientWebSocket</c>
    /// living in the net48 <c>NtAddOn.NinjaTrader</c> project. Keeping only this
    /// seam in the platform-agnostic <c>NtAddOn.Core</c> (netstandard2.0) project
    /// means the sender loop, the serialization, and the optional compression are
    /// all fully unit/property-testable with an in-memory fake — no real socket
    /// and no NinjaTrader install required.</para>
    ///
    /// <para><b>Contract for implementers and collaborators</b> (read carefully —
    /// tasks 4.7, 4.8, and 4.10 all depend on these guarantees):</para>
    /// <list type="number">
    ///   <item><description>
    ///   <b>Single connection, owned by the worker.</b> Exactly one logical
    ///   connection is active at a time. The background worker (the single
    ///   consumer of the Bounded_Queue) owns connection lifetime; the reconnect
    ///   loop (task 4.8) calls <see cref="ConnectAsync"/> /
    ///   <see cref="CloseAsync"/> to re-establish it. Implementations need not be
    ///   safe against two concurrent <see cref="ConnectAsync"/> calls.
    ///   </description></item>
    ///   <item><description>
    ///   <b>Send is the only concurrent surface.</b> The sender worker calls
    ///   <see cref="SendAsync"/>; the control-plane receive loop (task 4.10)
    ///   calls <see cref="ReceiveAsync"/>. These run concurrently on a single
    ///   established connection, so an implementation MUST allow one in-flight
    ///   send and one in-flight receive at the same time. Concurrent calls to
    ///   <see cref="SendAsync"/> from multiple threads are NOT required to be
    ///   supported (the worker is the single sender); task 4.10 status emission
    ///   that also needs to send MUST funnel through the worker rather than call
    ///   <see cref="SendAsync"/> concurrently.
    ///   </description></item>
    ///   <item><description>
    ///   <b>Faults surface as exceptions.</b> Any transport failure (not
    ///   connected, connection reset, server closed the socket, IO error) MUST
    ///   be surfaced by throwing from <see cref="SendAsync"/> /
    ///   <see cref="ReceiveAsync"/> / <see cref="ConnectAsync"/>. The sender
    ///   worker catches these, logs them, and signals the reconnect loop; it
    ///   never crashes the loop (Req 2.2, design "Worker fault tolerance").
    ///   </description></item>
    ///   <item><description>
    ///   <b>Cancellation.</b> All async members honor the supplied
    ///   <see cref="CancellationToken"/> and throw
    ///   <see cref="OperationCanceledException"/> when it is canceled, so a clean
    ///   shutdown unblocks a pending send/receive.
    ///   </description></item>
    /// </list>
    /// </summary>
    public interface IWebSocketClient : IDisposable
    {
        /// <summary>
        /// True when the client currently has an open connection to the Backend.
        /// Transitions to false after <see cref="CloseAsync"/>, after a fault, or
        /// when the server closes the socket. The worker uses this only as an
        /// advisory hint; the authoritative failure signal is an exception from
        /// <see cref="SendAsync"/> / <see cref="ReceiveAsync"/>.
        /// </summary>
        bool IsConnected { get; }

        /// <summary>
        /// Establishes the WebSocket connection to <paramref name="uri"/>
        /// (typically <see cref="NtAddOn.Core.Configuration.AddOnConfig.BuildBackendUri"/>).
        /// Throws on failure so the reconnect loop (task 4.8) can apply its
        /// Fibonacci backoff.
        /// </summary>
        /// <param name="uri">The Backend <c>ws://.../ws/nt</c> endpoint.</param>
        /// <param name="cancellationToken">Cancels a pending connect.</param>
        Task ConnectAsync(Uri uri, CancellationToken cancellationToken);

        /// <summary>
        /// Sends a single, already-serialized message frame to the Backend. The
        /// sender worker (task 4.7) performs JSON serialization and optional
        /// compression and passes the resulting bytes here; the transport does
        /// no serialization itself.
        /// </summary>
        /// <param name="payload">
        /// The frame bytes: UTF-8 JSON when <paramref name="kind"/> is
        /// <see cref="WebSocketMessageKind.Text"/>, or the compressed bytes when
        /// it is <see cref="WebSocketMessageKind.Binary"/>.
        /// </param>
        /// <param name="kind">Whether to send a text or binary frame.</param>
        /// <param name="cancellationToken">Cancels a pending send.</param>
        Task SendAsync(
            ArraySegment<byte> payload,
            WebSocketMessageKind kind,
            CancellationToken cancellationToken);

        /// <summary>
        /// Receives the next inbound message from the Backend (the control plane:
        /// subscribe/unsubscribe Control_Commands). Consumed by task 4.10. The
        /// sender worker does not call this; it is part of the shared transport
        /// seam so the control-plane receive loop can use the same connection.
        /// </summary>
        /// <param name="cancellationToken">Cancels a pending receive.</param>
        /// <returns>The received message (text payload + frame kind).</returns>
        Task<WebSocketReceiveResultMessage> ReceiveAsync(CancellationToken cancellationToken);

        /// <summary>
        /// Closes the connection gracefully. Safe to call when already closed
        /// (no-op). Used by the reconnect loop before re-connecting and on
        /// shutdown.
        /// </summary>
        /// <param name="cancellationToken">Cancels a pending close handshake.</param>
        Task CloseAsync(CancellationToken cancellationToken);
    }
}
