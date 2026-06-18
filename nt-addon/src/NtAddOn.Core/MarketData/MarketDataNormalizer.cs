using System;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Platform-agnostic normalization logic for the NinjaTrader callback path.
    ///
    /// The NinjaTrader adapter maps raw Level 1 callbacks into the primitive
    /// inputs accepted here; this normalizer then builds the canonical
    /// <see cref="NormalizedTrade"/> / <see cref="NormalizedQuote"/> shapes
    /// (Req 1.1, 1.2), tags each event with its originating Candidate_Contract
    /// (Req 1.6), assigns a monotonic per-Stream sequence via the injected
    /// <see cref="ISequenceSource"/> (Req 1.3), and enqueues the result into the
    /// injected <see cref="IEventSink"/> (Bounded_Queue).
    ///
    /// It performs NO IO, JSON serialization, or compression, so it is safe to
    /// invoke directly on the NinjaTrader market-data thread — the callback does
    /// normalize + enqueue ONLY (Req 2.1, 2.3). Both collaborators are seams so
    /// this class is fully unit/property-testable without NinjaTrader present.
    /// </summary>
    public sealed class MarketDataNormalizer
    {
        private readonly string _symbol;
        private readonly ISequenceSource _sequenceSource;
        private readonly IEventSink _sink;

        /// <summary>
        /// Creates a normalizer bound to a single user-facing
        /// <paramref name="symbol"/> (e.g. "GC").
        /// </summary>
        /// <param name="symbol">User-facing symbol applied to every event.</param>
        /// <param name="sequenceSource">Per-stream monotonic sequence source (Req 1.3).</param>
        /// <param name="sink">Bounded_Queue sink the callback enqueues into (Req 2.1).</param>
        public MarketDataNormalizer(string symbol, ISequenceSource sequenceSource, IEventSink sink)
        {
            if (string.IsNullOrWhiteSpace(symbol))
            {
                throw new ArgumentException("Symbol must be non-empty.", nameof(symbol));
            }

            _symbol = symbol;
            _sequenceSource = sequenceSource ?? throw new ArgumentNullException(nameof(sequenceSource));
            _sink = sink ?? throw new ArgumentNullException(nameof(sink));
        }

        /// <summary>
        /// Normalizes a Level 1 trade event, tags it with its originating
        /// <paramref name="contract"/> (Req 1.6), assigns a per-stream sequence
        /// (Req 1.3), and enqueues it (Req 2.1). Returns the event that was
        /// built so callers/tests can inspect it; the queue outcome is governed
        /// by the sink's overload policy (task 4.5).
        /// </summary>
        public NormalizedTrade NormalizeTrade(
            string contract,
            long time,
            double price,
            long volume,
            double? bid,
            double? ask,
            double? bestBid,
            double? bestAsk,
            long? timeTicks = null)
        {
            var streamId = new StreamId(_symbol, contract, Channel.Trade);
            var sequence = _sequenceSource.Next(streamId);
            var trade = new NormalizedTrade(
                _symbol, contract, time, price, volume, bid, ask, bestBid, bestAsk, sequence, timeTicks);

            _sink.Enqueue(trade);
            return trade;
        }

        /// <summary>
        /// Normalizes a Level 1 quote event, tags it with its originating
        /// <paramref name="contract"/> (Req 1.6), assigns a per-stream sequence
        /// (Req 1.3), and enqueues it (Req 2.1). Returns the event that was
        /// built so callers/tests can inspect it.
        /// </summary>
        public NormalizedQuote NormalizeQuote(
            string contract,
            long time,
            double bid,
            double ask,
            long bidSize,
            long askSize)
        {
            var streamId = new StreamId(_symbol, contract, Channel.Quote);
            var sequence = _sequenceSource.Next(streamId);
            var quote = new NormalizedQuote(
                _symbol, contract, time, bid, ask, bidSize, askSize, sequence);

            _sink.Enqueue(quote);
            return quote;
        }
    }
}
