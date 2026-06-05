using System;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Base type for a normalized Level 1 market-data event produced by the
    /// NinjaTrader callback path. A NormalizedEvent is the platform-agnostic,
    /// in-process representation of a trade or quote BEFORE serialization — the
    /// callback path only normalizes and enqueues these (Req 2.1, 2.3); JSON
    /// serialization, compression, and transmission happen later on the
    /// background worker.
    ///
    /// Every event carries its originating Candidate_Contract so downstream
    /// consumers (and the Backend Contract_Resolver) can attribute per-candidate
    /// activity (Req 1.6). The wire <c>type</c> discriminator ("trade"/"quote")
    /// and the <see cref="StreamId"/> are both derived from <see cref="Channel"/>.
    /// </summary>
    public abstract class NormalizedEvent : INormalizedEvent
    {
        /// <summary>Wire discriminator value for a trade message.</summary>
        public const string TradeType = "trade";

        /// <summary>Wire discriminator value for a quote message.</summary>
        public const string QuoteType = "quote";

        /// <summary>User-facing symbol, e.g. "GC".</summary>
        public string Symbol { get; }

        /// <summary>
        /// The originating Candidate_Contract identifier, e.g. "GC 08-26"
        /// (Req 1.6). This is the contract the event was captured from.
        /// </summary>
        public string Contract { get; }

        /// <summary>Trade or quote channel of this event.</summary>
        public Channel Channel { get; }

        /// <summary>
        /// Canonical_Timestamp: integer milliseconds since the Unix epoch in
        /// UTC (Glossary: Canonical_Timestamp).
        /// </summary>
        public long Time { get; }

        /// <summary>
        /// Monotonically increasing per-Stream sequence value (Req 1.3). The
        /// value is supplied by the per-stream sequence source at normalization
        /// time; this type does not generate it.
        /// </summary>
        public long Sequence { get; }

        /// <summary>
        /// Wire <c>type</c> discriminator: "trade" for a trade event, "quote"
        /// for a quote event (Req 1.1, 1.2).
        /// </summary>
        public string Type => Channel == Channel.Trade ? TradeType : QuoteType;

        /// <summary>
        /// Identity of the Stream this event belongs to: the tuple
        /// (symbol, contract, channel) used for per-stream sequencing (Req 1.3).
        /// </summary>
        public StreamId StreamId => new StreamId(Symbol, Contract, Channel);

        /// <summary>
        /// <see cref="INormalizedEvent.Stream"/> implementation: the Stream
        /// identity, so a normalized trade/quote can be buffered in the
        /// <see cref="NtAddOn.Core.Buffering.BoundedQueue"/> and consumed by the
        /// background sender worker without an adapter. Equivalent to
        /// <see cref="StreamId"/>.
        /// </summary>
        public StreamId Stream => StreamId;

        /// <summary>
        /// <see cref="INormalizedEvent.TimestampMs"/> implementation: the
        /// Canonical_Timestamp (ms since Unix epoch UTC). Equivalent to
        /// <see cref="Time"/>.
        /// </summary>
        public long TimestampMs => Time;

        /// <summary>
        /// Initializes the shared fields of a normalized event. Validates that
        /// the symbol and contract are present so every forwarded event is
        /// attributable to a Candidate_Contract (Req 1.6).
        /// </summary>
        protected NormalizedEvent(string symbol, string contract, Channel channel, long time, long sequence)
        {
            if (string.IsNullOrWhiteSpace(symbol))
            {
                throw new ArgumentException("Symbol must be non-empty.", nameof(symbol));
            }

            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException(
                    "Contract must be non-empty so the event can be tagged with its originating Candidate_Contract (Req 1.6).",
                    nameof(contract));
            }

            Symbol = symbol;
            Contract = contract;
            Channel = channel;
            Time = time;
            Sequence = sequence;
        }
    }
}
