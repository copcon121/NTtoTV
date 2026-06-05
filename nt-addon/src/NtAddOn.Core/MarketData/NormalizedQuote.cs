using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Normalized Level 1 quote event (Req 1.2). Carries the fields of the
    /// documented quote message shape: type (via <see cref="NormalizedEvent.Type"/>),
    /// symbol, contract, time, bid, ask, bidSize, askSize, and sequence. Times
    /// are Canonical_Timestamp (ms since Unix epoch UTC).
    /// </summary>
    public sealed class NormalizedQuote : NormalizedEvent
    {
        /// <summary>Best bid price (Req 1.2).</summary>
        public double Bid { get; }

        /// <summary>Best ask price (Req 1.2).</summary>
        public double Ask { get; }

        /// <summary>Size at the bid (Req 1.2).</summary>
        public long BidSize { get; }

        /// <summary>Size at the ask (Req 1.2).</summary>
        public long AskSize { get; }

        /// <summary>
        /// Constructs a normalized quote. <paramref name="contract"/> is the
        /// originating Candidate_Contract tag (Req 1.6); <paramref name="sequence"/>
        /// is the per-stream monotonic value supplied by the sequence source
        /// (Req 1.3).
        /// </summary>
        public NormalizedQuote(
            string symbol,
            string contract,
            long time,
            double bid,
            double ask,
            long bidSize,
            long askSize,
            long sequence)
            : base(symbol, contract, Channel.Quote, time, sequence)
        {
            Bid = bid;
            Ask = ask;
            BidSize = bidSize;
            AskSize = askSize;
        }
    }
}
