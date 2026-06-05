namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Destination for normalized events produced by the NinjaTrader callback
    /// path. The callback does normalize + enqueue ONLY (Req 2.1, 2.3): it hands
    /// each <see cref="NormalizedEvent"/> to this sink and returns immediately,
    /// never performing IO, serialization, or compression inline.
    ///
    /// This interface is the seam consumed by the market-data callback path in
    /// task 4.1; the concrete fixed-capacity, thread-safe Bounded_Queue
    /// implementation (retain-trades / coalesce-latest-quote / log-dropped-trade)
    /// is provided by task 4.5.
    /// </summary>
    public interface IEventSink
    {
        /// <summary>
        /// Enqueues a normalized event for the background worker to serialize
        /// and transmit. Implementations must be non-blocking and thread-safe so
        /// they are safe to call directly from the NinjaTrader market-data
        /// thread (Req 2.1).
        /// </summary>
        /// <returns>
        /// True if the event was retained; false if it was dropped or
        /// superseded by the queue's overload policy (Req 2.5, 2.6). The
        /// task 4.1 callback path treats the return value as advisory and never
        /// blocks on it.
        /// </returns>
        bool Enqueue(NormalizedEvent ev);
    }
}
