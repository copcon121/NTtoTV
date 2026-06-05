using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Describes a single scheduled reconnect retry: the attempt index, the
    /// delay that will be waited before the next attempt, and the failure that
    /// triggered it. Passed to the optional logging hook of
    /// <see cref="ReconnectLoop"/>.
    ///
    /// <para>This is a diagnostics/logging value only. It is deliberately
    /// distinct from the connected/degraded/disconnected <b>status events</b>
    /// (Req 3.4, 20.1), which are emitted by the control-plane/status work in
    /// task 4.10 — not by the reconnect loop.</para>
    /// </summary>
    public readonly struct ReconnectAttemptInfo
    {
        /// <summary>Zero-based index of the failed attempt being retried.</summary>
        public int AttemptIndex { get; }

        /// <summary>The backoff delay that will elapse before the next attempt.</summary>
        public TimeSpan Delay { get; }

        /// <summary>
        /// The exception thrown by the failed connection attempt, if any.
        /// </summary>
        public Exception? Error { get; }

        /// <summary>Creates a new <see cref="ReconnectAttemptInfo"/>.</summary>
        public ReconnectAttemptInfo(int attemptIndex, TimeSpan delay, Exception? error)
        {
            AttemptIndex = attemptIndex;
            Delay = delay;
            Error = error;
        }
    }
}
