namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Source of per-Stream monotonic sequence values (Req 1.3). The
    /// normalization path obtains the next sequence for an event's
    /// <see cref="StreamId"/> through this seam so that sequence assignment is
    /// decoupled from normalization.
    ///
    /// This interface is the seam consumed by the market-data callback path in
    /// task 4.1; the concrete monotonic, thread-safe implementation (a counter
    /// that increases independently per Stream) is provided by task 4.3.
    /// </summary>
    public interface ISequenceSource
    {
        /// <summary>
        /// Returns the next monotonically increasing sequence value for the
        /// given <paramref name="stream"/>. Values are independent across
        /// Streams (Req 1.3).
        /// </summary>
        long Next(StreamId stream);
    }
}
