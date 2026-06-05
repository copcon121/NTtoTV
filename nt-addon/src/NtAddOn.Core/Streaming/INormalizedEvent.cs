namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Minimal abstraction over a normalized market-data event as buffered by
    /// the <c>Bounded_Queue</c> (see <see cref="NtAddOn.Core.Buffering.BoundedQueue"/>).
    ///
    /// <para>
    /// The concrete normalized trade/quote types are produced by the
    /// market-data normalization step (task 4.1). That step assigns the
    /// per-Stream monotonic <see cref="Sequence"/> (Req 1.3) and the
    /// Canonical_Timestamp <see cref="TimestampMs"/>. Because the Bounded_Queue
    /// (task 4.5) and normalization (task 4.1) are implemented in parallel, the
    /// queue depends only on this small interface so the two can be developed
    /// independently and then integrated: the normalized trade and quote types
    /// SHOULD implement <see cref="INormalizedEvent"/>.
    /// </para>
    ///
    /// <para><b>Channel invariant.</b> The event's <see cref="StreamId.Channel"/>
    /// (exposed via <see cref="Stream"/>) MUST reflect the kind of event: a
    /// trade event belongs to a <see cref="Channel.Trade"/> Stream and a quote
    /// event belongs to a <see cref="Channel.Quote"/> Stream. The Bounded_Queue
    /// uses this to apply the trade-retention/drop policy (Req 2.4, 2.6) versus
    /// the quote latest-value-wins coalescing policy (Req 2.5). This matches the
    /// glossary definition of a Stream as the tuple (symbol, contract, channel).
    /// </para>
    /// </summary>
    public interface INormalizedEvent
    {
        /// <summary>
        /// Identity of the Stream this event belongs to: the tuple
        /// (symbol, contract, channel). The <see cref="StreamId.Channel"/>
        /// distinguishes trade events from quote events. (Glossary: Stream; Req 1.3)
        /// </summary>
        StreamId Stream { get; }

        /// <summary>
        /// The monotonically increasing per-Stream sequence assigned during
        /// normalization. Recorded when a trade is dropped under critical
        /// overload. (Req 1.3, 2.6)
        /// </summary>
        long Sequence { get; }

        /// <summary>
        /// The Canonical_Timestamp of the event: integer milliseconds since the
        /// Unix epoch (UTC). Recorded when a trade is dropped under critical
        /// overload. (Glossary: Canonical_Timestamp; Req 2.6)
        /// </summary>
        long TimestampMs { get; }
    }
}
