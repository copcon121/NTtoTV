using System.Collections.Generic;
using NtAddOn.Core.MarketData;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.MarketData
{
    /// <summary>
    /// Example/edge-case unit tests for task 4.1: market-data normalization and
    /// contract tagging. These verify the documented trade/quote message shapes
    /// (Req 1.1, 1.2), originating-contract tagging (Req 1.6), per-stream
    /// sequence assignment via the injected source (Req 1.3), and that the
    /// callback path normalizes + enqueues only (Req 2.1).
    ///
    /// The numbered correctness Property 2 (contract tagging) is implemented
    /// separately in task 4.2; these are complementary example-based tests.
    /// </summary>
    public class MarketDataNormalizerTests
    {
        /// <summary>Captures every enqueued event for assertions.</summary>
        private sealed class CapturingSink : IEventSink
        {
            public List<NormalizedEvent> Events { get; } = new List<NormalizedEvent>();

            public bool Enqueue(NormalizedEvent ev)
            {
                Events.Add(ev);
                return true;
            }
        }

        /// <summary>
        /// Deterministic per-stream monotonic source standing in for task 4.3's
        /// real implementation: independent counters per StreamId.
        /// </summary>
        private sealed class FakeSequenceSource : ISequenceSource
        {
            private readonly Dictionary<StreamId, long> _next = new Dictionary<StreamId, long>();

            public long Next(StreamId stream)
            {
                _next.TryGetValue(stream, out var current);
                _next[stream] = current + 1;
                return current;
            }
        }

        [Fact]
        public void NormalizeTrade_BuildsTradeShape_TaggedWithContract()
        {
            var sink = new CapturingSink();
            var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

            var trade = normalizer.NormalizeTrade(
                contract: "GC 08-26",
                time: 1730313600123,
                price: 2345.6,
                volume: 3,
                bid: 2345.5,
                ask: 2345.7,
                bestBid: 2345.5,
                bestAsk: 2345.7);

            Assert.Equal(NormalizedEvent.TradeType, trade.Type);
            Assert.Equal("GC", trade.Symbol);
            Assert.Equal("GC 08-26", trade.Contract);
            Assert.Equal(1730313600123, trade.Time);
            Assert.Equal(2345.6, trade.Price);
            Assert.Equal(3, trade.Volume);
            Assert.Equal(2345.5, trade.Bid);
            Assert.Equal(2345.7, trade.Ask);
            Assert.Equal(2345.5, trade.BestBid);
            Assert.Equal(2345.7, trade.BestAsk);
            Assert.Equal(Channel.Trade, trade.Channel);

            // normalize + enqueue only: the event reached the sink unchanged.
            Assert.Single(sink.Events);
            Assert.Same(trade, sink.Events[0]);
        }

        [Fact]
        public void NormalizeQuote_BuildsQuoteShape_TaggedWithContract()
        {
            var sink = new CapturingSink();
            var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

            var quote = normalizer.NormalizeQuote(
                contract: "GC 10-26",
                time: 1730313600125,
                bid: 2345.5,
                ask: 2345.7,
                bidSize: 12,
                askSize: 9);

            Assert.Equal(NormalizedEvent.QuoteType, quote.Type);
            Assert.Equal("GC", quote.Symbol);
            Assert.Equal("GC 10-26", quote.Contract);
            Assert.Equal(1730313600125, quote.Time);
            Assert.Equal(2345.5, quote.Bid);
            Assert.Equal(2345.7, quote.Ask);
            Assert.Equal(12, quote.BidSize);
            Assert.Equal(9, quote.AskSize);
            Assert.Equal(Channel.Quote, quote.Channel);

            Assert.Single(sink.Events);
            Assert.Same(quote, sink.Events[0]);
        }

        [Fact]
        public void Sequences_AreIndependentPerStream()
        {
            var sink = new CapturingSink();
            var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

            var t1 = normalizer.NormalizeTrade("GC 08-26", 1, 2345.6, 1, null, null, null, null);
            var t2 = normalizer.NormalizeTrade("GC 08-26", 2, 2345.7, 1, null, null, null, null);
            // Different contract -> different Stream -> independent counter.
            var t3 = normalizer.NormalizeTrade("GC 10-26", 3, 2345.8, 1, null, null, null, null);
            // Same contract, different channel -> independent counter.
            var q1 = normalizer.NormalizeQuote("GC 08-26", 4, 2345.5, 2345.7, 1, 1);

            Assert.Equal(0, t1.Sequence);
            Assert.Equal(1, t2.Sequence);
            Assert.Equal(0, t3.Sequence);
            Assert.Equal(0, q1.Sequence);
        }

        [Fact]
        public void Trade_StreamId_IsSymbolContractChannel()
        {
            var sink = new CapturingSink();
            var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

            var trade = normalizer.NormalizeTrade("GC 08-26", 1, 2345.6, 1, null, null, null, null);

            Assert.Equal(new StreamId("GC", "GC 08-26", Channel.Trade), trade.StreamId);
        }

        [Fact]
        public void Trade_AllowsNullSnapshotFields()
        {
            var sink = new CapturingSink();
            var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

            var trade = normalizer.NormalizeTrade("GC 08-26", 1, 2345.6, 5, null, null, null, null);

            Assert.Null(trade.Bid);
            Assert.Null(trade.Ask);
            Assert.Null(trade.BestBid);
            Assert.Null(trade.BestAsk);
        }
    }
}
