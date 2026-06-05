using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.Buffering
{
    /// <summary>
    /// Logging abstraction used by the <see cref="BoundedQueue"/> to record
    /// every trade event dropped because the queue is critically overloaded
    /// (Req 2.6). A logging interface (rather than a hard dependency on a
    /// concrete logger) keeps <c>NtAddOn.Core</c> platform-agnostic and lets
    /// the NinjaTrader host, tests, and the background worker supply their own
    /// sink (NinjaScript Output window, file, in-memory list, etc.).
    /// </summary>
    public interface IDroppedTradeLogger
    {
        /// <summary>
        /// Records that a single trade event was dropped due to critical
        /// queue overload. Implementations MUST record at least the stream,
        /// sequence, and timestamp so each drop is auditable (Req 2.6).
        /// </summary>
        /// <param name="stream">The Stream the dropped trade belonged to.</param>
        /// <param name="sequence">The dropped trade's per-Stream sequence.</param>
        /// <param name="timestampMs">
        /// The dropped trade's Canonical_Timestamp (ms since Unix epoch, UTC).
        /// </param>
        void LogDroppedTrade(StreamId stream, long sequence, long timestampMs);
    }
}
