using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Logging seam for the background sender worker (task 4.7). A logging
    /// interface (rather than a hard dependency on a concrete logger) keeps
    /// <c>NtAddOn.Core</c> platform-agnostic and lets the NinjaTrader host
    /// (NinjaScript Output window), tests (in-memory list), and other callers
    /// supply their own sink — the same pattern used by
    /// <see cref="NtAddOn.Core.Buffering.IDroppedTradeLogger"/>.
    ///
    /// <para>The worker must be fault-tolerant: serialization, compression, and
    /// transport errors are caught and reported here, never allowed to crash the
    /// loop or propagate onto the NinjaTrader threads (Req 2.2, design "Worker
    /// fault tolerance").</para>
    /// </summary>
    public interface IWorkerLogger
    {
        /// <summary>Records an informational worker lifecycle message.</summary>
        void LogInfo(string message);

        /// <summary>
        /// Records a recoverable worker error (a caught serialization,
        /// compression, or transport failure). The worker continues running
        /// after logging.
        /// </summary>
        /// <param name="message">Human-readable context for the failure.</param>
        /// <param name="exception">The caught exception, if any.</param>
        void LogError(string message, Exception? exception);
    }
}
