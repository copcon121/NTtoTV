using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck.Xunit;
using NtAddOn.Core.Buffering;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.Buffering
{
    /// <summary>
    /// Numbered correctness property for the <see cref="BoundedQueue"/>
    /// (Bounded_Queue, task 4.6).
    ///
    ///     Feature: gc-chart-platform, Property 3: Bounded_Queue retains trades under threshold, coalesces quotes at capacity, and logs trade drops
    ///     Validates: Requirements 2.4, 2.5, 2.6
    ///
    /// <para>This single property exercises the three facets of design Property 3
    /// across arbitrary capacities, thresholds, and event sequences:</para>
    /// <list type="bullet">
    ///   <item><description>
    ///     <b>(a) Retain under threshold (Req 2.4).</b> While the queue stays
    ///     below the critical-overload threshold, every enqueued trade is
    ///     retained — nothing is dropped — and all trades are later dequeued in
    ///     FIFO order.
    ///   </description></item>
    ///   <item><description>
    ///     <b>(b) Coalesce at capacity (Req 2.5).</b> When quotes arrive at
    ///     capacity, the depth never exceeds <see cref="BoundedQueue.Capacity"/>
    ///     and the retained quote for each stream is the most recent one
    ///     (latest-quote-wins); superseded quotes are discarded.
    ///   </description></item>
    ///   <item><description>
    ///     <b>(c) Log every dropped trade (Req 2.6).</b> Across any mixed
    ///     sequence, the dropped-trade log count equals the number of dropped
    ///     trades, each logged entry carries the dropped trade's stream,
    ///     sequence, and timestamp, and trades are conserved
    ///     (enqueued == retained + dropped).
    ///   </description></item>
    /// </list>
    ///
    /// <para>This is the numbered design property and is deliberately distinct
    /// from the example/edge-case unit tests in <see cref="BoundedQueueTests"/>.
    /// It runs at >= 100 iterations per the design Testing Strategy.</para>
    ///
    /// <para><b>Generation strategy.</b> FsCheck natively generates the three
    /// parameters. <c>capSeed</c>/<c>thrSeed</c> are folded into a valid
    /// <c>(capacity, threshold)</c> pair with <c>1 &lt;= threshold &lt;= capacity</c>
    /// (capacity bounded to keep the multi-phase test fast over many iterations),
    /// and each element of <c>opSeeds</c> is mapped deterministically onto a
    /// trade-or-quote event over a small multi-stream universe. This yields
    /// arbitrary-length, arbitrary-order, mixed trade/quote interleavings that
    /// drive the queue through the under-threshold, critical-overload, and
    /// at-capacity regimes without a custom Arbitrary.</para>
    /// </summary>
    public class BoundedQueuePropertyTests
    {
        private const int Iterations = 200;

        /// <summary>Upper bound on generated capacity (keeps phases (b)/(c) fast).</summary>
        private const int MaxCapacity = 64;

        /// <summary>Number of distinct streams the mixed phase spreads events over.</summary>
        private const int StreamSpread = 5;

        // ---- test doubles ------------------------------------------------

        private sealed class Ev : INormalizedEvent
        {
            public Ev(StreamId stream, long sequence, long timestampMs)
            {
                Stream = stream;
                Sequence = sequence;
                TimestampMs = timestampMs;
            }

            public StreamId Stream { get; }
            public long Sequence { get; }
            public long TimestampMs { get; }
        }

        private sealed class RecordingDropLogger : IDroppedTradeLogger
        {
            public readonly List<(StreamId Stream, long Sequence, long TimestampMs)> Drops =
                new List<(StreamId, long, long)>();

            public void LogDroppedTrade(StreamId stream, long sequence, long timestampMs) =>
                Drops.Add((stream, sequence, timestampMs));
        }

        // ---- helpers -----------------------------------------------------

        // Non-negative modulo that is safe for every int (including int.MinValue).
        private static int SafeMod(int value, int modulus) =>
            (int)((((long)value % modulus) + modulus) % modulus);

        // The next per-stream sequence (1-based, strictly increasing per stream),
        // mirroring how normalization assigns sequences (Req 1.3).
        private static long NextSequence(IDictionary<StreamId, long> counters, StreamId stream)
        {
            counters.TryGetValue(stream, out var last);
            var next = last + 1;
            counters[stream] = next;
            return next;
        }

        // ---- the property ------------------------------------------------

        [Property(MaxTest = Iterations)]
        public bool BoundedQueue_RetainsUnderThreshold_CoalescesAtCapacity_AndLogsTradeDrops(
            int capSeed, int thrSeed, int[]? opSeeds)
        {
            opSeeds ??= Array.Empty<int>();

            var capacity = 1 + SafeMod(capSeed, MaxCapacity);          // [1, MaxCapacity]
            var threshold = 1 + SafeMod(thrSeed, capacity);            // [1, capacity]

            return MixedSequence_LogsEveryDroppedTrade(capacity, threshold, opSeeds)   // facet (c)
                && UnderThreshold_RetainsEveryTrade(capacity, threshold, opSeeds)      // facet (a)
                && AtCapacity_CoalescesLatestQuotePerStream(capacity, threshold);      // facet (b)
        }

        // facet (c): across any mixed trade/quote sequence, the depth never
        // exceeds capacity, every dropped trade is logged exactly once with its
        // stream/sequence/timestamp, the log count equals the number of dropped
        // trades, and trades are conserved (enqueued == retained + dropped).
        private static bool MixedSequence_LogsEveryDroppedTrade(
            int capacity, int threshold, int[] opSeeds)
        {
            var logger = new RecordingDropLogger();
            var queue = new BoundedQueue(capacity, threshold, logger);

            var perStreamSeq = new Dictionary<StreamId, long>();
            var enqueuedTradeKeys = new HashSet<(StreamId, long, long)>();
            var enqueuedAnyKeys = new HashSet<(StreamId, long, long)>();
            long timestamp = 0;
            var tradesEnqueued = 0;

            foreach (var seed in opSeeds)
            {
                var isTrade = (seed & 1) == 0;
                var channel = isTrade ? Channel.Trade : Channel.Quote;
                var contract = "K" + SafeMod(seed / 2, StreamSpread);
                var stream = new StreamId("GC", contract, channel);

                var seq = NextSequence(perStreamSeq, stream);
                var ts = ++timestamp;
                var key = (stream, seq, ts);

                queue.Enqueue(new Ev(stream, seq, ts));

                // Capacity is never exceeded at any point (Req 2.5).
                if (queue.Count > capacity)
                {
                    return false;
                }

                enqueuedAnyKeys.Add(key);
                if (isTrade)
                {
                    tradesEnqueued++;
                    enqueuedTradeKeys.Add(key);
                }
            }

            // The dropped-trade log count equals the number of dropped trades (Req 2.6).
            if (queue.DroppedTradeCount != logger.Drops.Count)
            {
                return false;
            }

            // Every logged drop is a real trade event recorded with its
            // stream, sequence, and timestamp (Req 2.6).
            foreach (var drop in logger.Drops)
            {
                if (drop.Stream.Channel != Channel.Trade)
                {
                    return false;
                }

                if (!enqueuedTradeKeys.Contains((drop.Stream, drop.Sequence, drop.TimestampMs)))
                {
                    return false;
                }
            }

            // Drain the queue and confirm conservation + no fabricated events.
            var drained = new List<INormalizedEvent>();
            while (queue.TryDequeue(out var ev))
            {
                drained.Add(ev!);
            }

            foreach (var ev in drained)
            {
                if (!enqueuedAnyKeys.Contains((ev.Stream, ev.Sequence, ev.TimestampMs)))
                {
                    return false;
                }
            }

            // Trade conservation: every enqueued trade was either retained
            // (and just drained) or dropped (and logged) — never silently lost.
            var drainedTrades = drained.Count(ev => ev.Stream.Channel == Channel.Trade);
            return tradesEnqueued == drainedTrades + (int)queue.DroppedTradeCount;
        }

        // facet (a): while the queue stays below the critical-overload threshold,
        // every trade is retained (no drops) and all are dequeued in FIFO order.
        private static bool UnderThreshold_RetainsEveryTrade(
            int capacity, int threshold, int[] opSeeds)
        {
            var logger = new RecordingDropLogger();
            var queue = new BoundedQueue(capacity, threshold, logger);

            // Enqueue between 0 and `threshold` trades. The k-th enqueue happens
            // at depth k-1 < threshold, so the queue is never critically
            // overloaded and no trade is dropped (Req 2.4).
            var tradeCount = SafeMod(opSeeds.Length, threshold + 1); // [0, threshold]
            var stream = new StreamId("GC", "GC 08-26", Channel.Trade);

            for (long i = 1; i <= tradeCount; i++)
            {
                if (!queue.Enqueue(new Ev(stream, i, i)))
                {
                    return false; // a sub-threshold trade must always be retained
                }
            }

            if (logger.Drops.Count != 0 ||
                queue.DroppedTradeCount != 0 ||
                queue.Count != tradeCount)
            {
                return false;
            }

            // FIFO: every retained trade is dequeued in enqueue order, none lost.
            for (long i = 1; i <= tradeCount; i++)
            {
                if (!queue.TryDequeue(out var ev) || ev!.Sequence != i)
                {
                    return false;
                }
            }

            return !queue.TryDequeue(out _); // nothing left over
        }

        // facet (b): when quotes arrive at capacity, the depth never exceeds
        // capacity and each stream retains only its most recent quote
        // (latest-quote-wins); superseded quotes are discarded (Req 2.5).
        private static bool AtCapacity_CoalescesLatestQuotePerStream(int capacity, int threshold)
        {
            var logger = new RecordingDropLogger();
            var queue = new BoundedQueue(capacity, threshold, logger);

            // One distinct quote stream per slot so capacity is filled by exactly
            // one quote per stream.
            var streams = Enumerable.Range(0, capacity)
                .Select(i => new StreamId("GC", "Q" + i, Channel.Quote))
                .ToArray();

            long ts = 0;

            // Round 1: fill capacity with the first quote (seq 1) for each stream.
            foreach (var stream in streams)
            {
                queue.Enqueue(new Ev(stream, sequence: 1, timestampMs: ++ts));
                if (queue.Count > capacity)
                {
                    return false;
                }
            }

            if (queue.Count != capacity)
            {
                return false;
            }

            // Round 2: a newer quote (seq 2) for each stream arrives at capacity;
            // each coalesces against that stream's buffered quote.
            foreach (var stream in streams)
            {
                queue.Enqueue(new Ev(stream, sequence: 2, timestampMs: ++ts));
                if (queue.Count != capacity) // capacity strictly honored on coalesce
                {
                    return false;
                }
            }

            // One coalesce per round-2 quote; quote drops are never logged as trades.
            if (queue.CoalescedQuoteCount != capacity ||
                queue.DroppedTradeCount != 0 ||
                logger.Drops.Count != 0)
            {
                return false;
            }

            // Drain: each stream appears exactly once, holding its most recent
            // quote (seq 2); the superseded seq-1 quotes were discarded.
            var seen = new HashSet<StreamId>();
            while (queue.TryDequeue(out var ev))
            {
                if (ev!.Stream.Channel != Channel.Quote || ev.Sequence != 2)
                {
                    return false; // a stale (superseded) quote survived
                }

                if (!seen.Add(ev.Stream))
                {
                    return false; // a stream retained more than one quote
                }
            }

            return seen.Count == capacity;
        }
    }
}
