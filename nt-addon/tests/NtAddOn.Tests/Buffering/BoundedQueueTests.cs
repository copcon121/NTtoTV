using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NtAddOn.Core.Buffering;
using NtAddOn.Core.Configuration;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Buffering
{
    /// <summary>
    /// Example/edge-case unit tests for the Bounded_Queue (task 4.5,
    /// Req 2.4-2.6). These complement — and do NOT duplicate — the numbered
    /// correctness "Property 3" property-based test, which is implemented
    /// separately by task 4.6.
    /// </summary>
    public class BoundedQueueTests
    {
        // ---- test doubles ------------------------------------------------

        private sealed class FakeEvent : INormalizedEvent
        {
            public FakeEvent(StreamId stream, long sequence, long timestampMs)
            {
                Stream = stream;
                Sequence = sequence;
                TimestampMs = timestampMs;
            }

            public StreamId Stream { get; }
            public long Sequence { get; }
            public long TimestampMs { get; }
        }

        private sealed class RecordingLogger : IDroppedTradeLogger
        {
            public readonly List<(StreamId Stream, long Sequence, long TimestampMs)> Drops =
                new List<(StreamId, long, long)>();

            public void LogDroppedTrade(StreamId stream, long sequence, long timestampMs) =>
                Drops.Add((stream, sequence, timestampMs));
        }

        private static StreamId TradeStream(string contract = "GC 08-26") =>
            new StreamId("GC", contract, Channel.Trade);

        private static StreamId QuoteStream(string contract = "GC 08-26") =>
            new StreamId("GC", contract, Channel.Quote);

        private static FakeEvent Trade(long seq, long ts = 0, string contract = "GC 08-26") =>
            new FakeEvent(TradeStream(contract), seq, ts == 0 ? seq : ts);

        private static FakeEvent Quote(long seq, long ts = 0, string contract = "GC 08-26") =>
            new FakeEvent(QuoteStream(contract), seq, ts == 0 ? seq : ts);

        // ---- construction ------------------------------------------------

        [Fact]
        public void Constructor_FromConfig_UsesCapacityAndThreshold()
        {
            var config = new AddOnConfig(
                new[] { "GC 08-26" }, queueCapacity: 500, criticalOverloadThreshold: 400);
            var queue = new BoundedQueue(config, new RecordingLogger());

            Assert.Equal(500, queue.Capacity);
            Assert.Equal(400, queue.CriticalOverloadThreshold);
        }

        [Theory]
        [InlineData(0, 1)]
        [InlineData(10, 0)]
        [InlineData(10, 11)]
        public void Constructor_InvalidArguments_Throw(int capacity, int threshold)
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => new BoundedQueue(capacity, threshold, new RecordingLogger()));
        }

        [Fact]
        public void Constructor_NullLogger_Throws()
        {
            Assert.Throws<ArgumentNullException>(() => new BoundedQueue(10, 5, null!));
        }

        // ---- Req 2.4: retain trades below the critical-overload threshold

        [Fact]
        public void Trades_BelowThreshold_AreAllRetainedInFifoOrder()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 100, criticalOverloadThreshold: 10, logger);

            for (long i = 1; i <= 9; i++)
            {
                Assert.True(queue.Enqueue(Trade(i)));
            }

            Assert.Equal(9, queue.Count);
            Assert.Empty(logger.Drops);

            // FIFO: dequeue order matches enqueue order, nothing lost (Property 3a).
            for (long i = 1; i <= 9; i++)
            {
                Assert.Equal(i, queue.Dequeue().Sequence);
            }
        }

        [Fact]
        public void Trade_ReachingThreshold_IsStillRetained()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 100, criticalOverloadThreshold: 5, logger);

            // 5 enqueues take depth from 0 -> 5; each was below threshold when added.
            for (long i = 1; i <= 5; i++)
            {
                Assert.True(queue.Enqueue(Trade(i)));
            }

            Assert.Equal(5, queue.Count);
            Assert.Empty(logger.Drops);
        }

        // ---- Req 2.6: drop + log trades under critical overload ----------

        [Fact]
        public void Trades_AtThreshold_DropOldestAndLogEachDrop()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 100, criticalOverloadThreshold: 3, logger);

            queue.Enqueue(Trade(1));
            queue.Enqueue(Trade(2));
            queue.Enqueue(Trade(3)); // depth now == threshold (3)

            // Next trades are critically overloaded: drop-oldest-with-log.
            Assert.True(queue.Enqueue(Trade(4))); // evicts seq 1
            Assert.True(queue.Enqueue(Trade(5))); // evicts seq 2

            Assert.Equal(3, queue.Count);          // depth stays bounded at threshold
            Assert.Equal(2, queue.DroppedTradeCount);

            // Every dropped trade is logged with stream, sequence, timestamp (Req 2.6).
            Assert.Equal(2, logger.Drops.Count);
            Assert.Equal(new long[] { 1, 2 }, logger.Drops.Select(d => d.Sequence).ToArray());
            Assert.All(logger.Drops, d => Assert.Equal(Channel.Trade, d.Stream.Channel));
            Assert.Equal(1, logger.Drops[0].TimestampMs);
            Assert.Equal(2, logger.Drops[1].TimestampMs);

            // The freshest trades survive.
            Assert.Equal(new long[] { 3, 4, 5 },
                new[] { queue.Dequeue().Sequence, queue.Dequeue().Sequence, queue.Dequeue().Sequence });
        }

        [Fact]
        public void DroppedTradeLogCount_EqualsNumberOfDroppedTrades()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 50, criticalOverloadThreshold: 2, logger);

            for (long i = 1; i <= 20; i++)
            {
                queue.Enqueue(Trade(i));
            }

            // Property 3c: dropped-trade log count == number of dropped trades.
            Assert.Equal(queue.DroppedTradeCount, logger.Drops.Count);
            Assert.Equal(18, queue.DroppedTradeCount); // 20 enqueued, 2 retained
        }

        // ---- Req 2.5: coalesce quotes at capacity ------------------------

        [Fact]
        public void Quote_AtCapacity_CoalescesLatestWinsPerStream()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 3, criticalOverloadThreshold: 3, logger);

            // Fill capacity with quotes for one stream.
            queue.Enqueue(Quote(1));
            queue.Enqueue(Quote(2));
            queue.Enqueue(Quote(3));
            Assert.Equal(3, queue.Count);

            // At capacity: newest quote supersedes the most recent buffered quote.
            Assert.True(queue.Enqueue(Quote(4)));
            Assert.Equal(3, queue.Count);                 // capacity honored
            Assert.Equal(1, queue.CoalescedQuoteCount);

            // The retained quote for the stream is the most recent one (seq 4),
            // taking the superseded quote's position (after seq 1, 2).
            Assert.Equal(1, queue.Dequeue().Sequence);
            Assert.Equal(2, queue.Dequeue().Sequence);
            Assert.Equal(4, queue.Dequeue().Sequence);
        }

        [Fact]
        public void Quote_AtCapacity_CoalescesPerStreamIndependently()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 2, criticalOverloadThreshold: 2, logger);

            queue.Enqueue(Quote(10, contract: "GC 08-26"));
            queue.Enqueue(Quote(20, contract: "GC 10-26"));
            Assert.Equal(2, queue.Count);

            // Each stream coalesces against its own latest buffered quote.
            Assert.True(queue.Enqueue(Quote(11, contract: "GC 08-26")));
            Assert.True(queue.Enqueue(Quote(21, contract: "GC 10-26")));

            Assert.Equal(2, queue.Count);
            Assert.Equal(2, queue.CoalescedQuoteCount);

            var first = queue.Dequeue();
            var second = queue.Dequeue();
            Assert.Equal("GC 08-26", first.Stream.Contract);
            Assert.Equal(11, first.Sequence);
            Assert.Equal("GC 10-26", second.Stream.Contract);
            Assert.Equal(21, second.Sequence);
        }

        [Fact]
        public void Quotes_DoNotTriggerDroppedTradeLog()
        {
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 2, criticalOverloadThreshold: 1, logger);

            queue.Enqueue(Quote(1));
            queue.Enqueue(Quote(2));
            queue.Enqueue(Quote(3)); // coalesces; not a trade drop

            Assert.Empty(logger.Drops);
            Assert.Equal(0, queue.DroppedTradeCount);
        }

        // ---- mixed + consumer --------------------------------------------

        [Fact]
        public void TryDequeue_OnEmptyQueue_ReturnsFalse()
        {
            var queue = new BoundedQueue(10, 5, new RecordingLogger());

            Assert.False(queue.TryDequeue(out var ev));
            Assert.Null(ev);
        }

        [Fact]
        public void Dequeue_WithCanceledToken_Throws()
        {
            var queue = new BoundedQueue(10, 5, new RecordingLogger());
            using var cts = new CancellationTokenSource();
            cts.Cancel();

            Assert.Throws<OperationCanceledException>(() => queue.Dequeue(cts.Token));
        }

        [Fact]
        public async Task Dequeue_BlocksUntilEnqueue_ThenReturnsEvent()
        {
            var queue = new BoundedQueue(10, 5, new RecordingLogger());

            var consumer = Task.Run(() => queue.Dequeue(CancellationToken.None));
            Assert.False(consumer.IsCompleted); // nothing to consume yet

            queue.Enqueue(Trade(42));

            var ev = await consumer.ConfigureAwait(false);
            Assert.Equal(42, ev.Sequence);
        }

        [Fact]
        public void Enqueue_Null_Throws()
        {
            var queue = new BoundedQueue(10, 5, new RecordingLogger());
            Assert.Throws<ArgumentNullException>(() => queue.Enqueue(null!));
        }

        [Fact]
        public async Task ConcurrentProducerConsumer_LosesNoTradeBelowThreshold()
        {
            // Single producer + single consumer (the real usage pattern). With a
            // high threshold no trade is dropped, so the consumer sees them all.
            var logger = new RecordingLogger();
            var queue = new BoundedQueue(capacity: 10_000, criticalOverloadThreshold: 10_000, logger);
            const int total = 5_000;

            var produced = new List<long>(total);
            var consumer = Task.Run(() =>
            {
                var seen = new List<long>(total);
                for (int i = 0; i < total; i++)
                {
                    seen.Add(queue.Dequeue().Sequence);
                }
                return seen;
            });

            for (long i = 0; i < total; i++)
            {
                produced.Add(i);
                queue.Enqueue(Trade(i, ts: i + 1));
            }

            var consumed = await consumer.ConfigureAwait(false);

            Assert.Empty(logger.Drops);
            // FIFO from a single producer: order is preserved exactly.
            Assert.Equal(produced, consumed);
        }
    }
}
