using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Normalized Level 1 trade event (Req 1.1). Carries the fields of the
    /// documented trade message shape: type (via <see cref="NormalizedEvent.Type"/>),
    /// symbol, contract, time, price, volume, bid, ask, bestBid, bestAsk, and
    /// sequence. Times are Canonical_Timestamp (ms since Unix epoch UTC).
    ///
    /// The bid/ask and bestBid/bestAsk snapshots are the quote state captured
    /// alongside the print; they are nullable because a trade can arrive before
    /// any quote snapshot is known (the Backend's parity logic depends on this
    /// snapshot state being preserved exactly as observed).
    /// </summary>
    public sealed class NormalizedTrade : NormalizedEvent
    {
        /// <summary>Trade print price, in contract price units (Req 1.1).</summary>
        public double Price { get; }

        /// <summary>Trade size (Req 1.1).</summary>
        public long Volume { get; }

        /// <summary>Snapshot bid at the time of the print, if known (Req 1.1).</summary>
        public double? Bid { get; }

        /// <summary>Snapshot ask at the time of the print, if known (Req 1.1).</summary>
        public double? Ask { get; }

        /// <summary>Best bid snapshot at the time of the print, if known (Req 1.1).</summary>
        public double? BestBid { get; }

        /// <summary>Best ask snapshot at the time of the print, if known (Req 1.1).</summary>
        public double? BestAsk { get; }

        /// <summary>
        /// Constructs a normalized trade. <paramref name="contract"/> is the
        /// originating Candidate_Contract tag (Req 1.6); <paramref name="sequence"/>
        /// is the per-stream monotonic value supplied by the sequence source
        /// (Req 1.3).
        /// </summary>
        public NormalizedTrade(
            string symbol,
            string contract,
            long time,
            double price,
            long volume,
            double? bid,
            double? ask,
            double? bestBid,
            double? bestAsk,
            long sequence)
            : base(symbol, contract, Channel.Trade, time, sequence)
        {
            Price = price;
            Volume = volume;
            Bid = bid;
            Ask = ask;
            BestBid = bestBid;
            BestAsk = bestAsk;
        }
    }
}
