using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Example/edge-case unit tests for <see cref="SequenceGenerator"/> (task 4.3,
    /// Req 1.3). These complement — but are deliberately NOT — the numbered
    /// correctness property "Property 1: Per-stream sequence assignment is
    /// strictly monotonic", which is implemented separately by task 4.4 using the
    /// tag format "Feature: gc-chart-platform, Property 1". Here we cover concrete
    /// examples, boundary behavior, and concurrency safety.
    /// </summary>
    public class SequenceGeneratorTests
    {
        private static StreamId Trade(string contract = "GC 08-26") =>
            new StreamId("GC", contract, Channel.Trade);

        private static StreamId Quote(string contract = "GC 08-26") =>
            new StreamId("GC", contract, Channel.Quote);

        [Fact]
        public void FirstSequenceForAStream_IsOne()
        {
            var generator = new SequenceGenerator();

            Assert.Equal(1L, generator.NextSequence(Trade()));
        }

        [Fact]
        public void RepeatedCalls_AreStrictlyMonotonicByOne()
        {
            var generator = new SequenceGenerator();
            var stream = Trade();

            var values = Enumerable.Range(0, 5)
                .Select(_ => generator.NextSequence(stream))
                .ToArray();

            Assert.Equal(new[] { 1L, 2L, 3L, 4L, 5L }, values);
        }

        [Fact]
        public void Streams_DifferingOnlyByChannel_AreIndependent()
        {
            var generator = new SequenceGenerator();
            var trade = Trade();
            var quote = Quote();

            // Interleave trade and quote events for the same symbol+contract.
            Assert.Equal(1L, generator.NextSequence(trade));
            Assert.Equal(1L, generator.NextSequence(quote));
            Assert.Equal(2L, generator.NextSequence(trade));
            Assert.Equal(2L, generator.NextSequence(quote));
            Assert.Equal(3L, generator.NextSequence(trade));
        }

        [Fact]
        public void Streams_DifferingOnlyByContract_AreIndependent()
        {
            var generator = new SequenceGenerator();
            var aug = Trade("GC 08-26");
            var oct = Trade("GC 10-26");

            Assert.Equal(1L, generator.NextSequence(aug));
            Assert.Equal(1L, generator.NextSequence(oct));
            Assert.Equal(2L, generator.NextSequence(aug));
            Assert.Equal(2L, generator.NextSequence(oct));
        }

        [Fact]
        public void ValueEqualStreamIds_ShareTheSameCounter()
        {
            var generator = new SequenceGenerator();

            // Two distinct StreamId values that are value-equal must map to the
            // same per-stream counter.
            generator.NextSequence(new StreamId("GC", "GC 08-26", Channel.Trade));
            var second = generator.NextSequence(new StreamId("GC", "GC 08-26", Channel.Trade));

            Assert.Equal(2L, second);
            Assert.Equal(1, generator.StreamCount);
        }

        [Fact]
        public void ComponentOverload_MatchesStreamIdOverload()
        {
            var generator = new SequenceGenerator();

            Assert.Equal(1L, generator.NextSequence("GC", "GC 08-26", Channel.Trade));
            Assert.Equal(2L, generator.NextSequence(new StreamId("GC", "GC 08-26", Channel.Trade)));
        }

        [Fact]
        public void Current_IsZeroBeforeAnySequenceIssued()
        {
            var generator = new SequenceGenerator();

            Assert.Equal(0L, generator.Current(Trade()));
        }

        [Fact]
        public void Current_ReflectsLastIssuedWithoutAdvancing()
        {
            var generator = new SequenceGenerator();
            var stream = Trade();

            generator.NextSequence(stream);
            generator.NextSequence(stream);

            Assert.Equal(2L, generator.Current(stream));
            // Reading Current did not advance the counter.
            Assert.Equal(2L, generator.Current(stream));
            Assert.Equal(3L, generator.NextSequence(stream));
        }

        [Fact]
        public void StreamCount_TracksDistinctStreams()
        {
            var generator = new SequenceGenerator();

            generator.NextSequence(Trade("GC 08-26"));
            generator.NextSequence(Quote("GC 08-26"));
            generator.NextSequence(Trade("GC 10-26"));
            // Repeat of an existing stream does not add a new counter.
            generator.NextSequence(Trade("GC 08-26"));

            Assert.Equal(3, generator.StreamCount);
        }

        [Fact]
        public async Task ConcurrentCallsForSameStream_ProduceNoDuplicatesAndContiguousRange()
        {
            var generator = new SequenceGenerator();
            var stream = Trade();
            const int threads = 8;
            const int perThread = 5_000;

            var tasks = Enumerable.Range(0, threads)
                .Select(_ => Task.Run(() =>
                {
                    var local = new long[perThread];
                    for (var i = 0; i < perThread; i++)
                    {
                        local[i] = generator.NextSequence(stream);
                    }

                    return local;
                }))
                .ToArray();

            var results = await Task.WhenAll(tasks).ConfigureAwait(false);

            var all = results.SelectMany(r => r).ToList();
            var distinct = new HashSet<long>(all);

            // Every value is unique (no duplicates under concurrency)...
            Assert.Equal(all.Count, distinct.Count);
            // ...and the issued values form the contiguous range [1, N] with no
            // gaps, proving exactly-once monotonic assignment.
            Assert.Equal(threads * perThread, all.Count);
            Assert.Equal(1L, all.Min());
            Assert.Equal((long)(threads * perThread), all.Max());
            Assert.Equal((long)(threads * perThread), generator.Current(stream));
        }

        [Fact]
        public async Task ConcurrentCallsAcrossStreams_RemainIndependent()
        {
            var generator = new SequenceGenerator();
            var trade = Trade();
            var quote = Quote();
            const int perStream = 10_000;

            var tradeTask = Task.Run(() =>
            {
                for (var i = 0; i < perStream; i++)
                {
                    generator.NextSequence(trade);
                }
            });
            var quoteTask = Task.Run(() =>
            {
                for (var i = 0; i < perStream; i++)
                {
                    generator.NextSequence(quote);
                }
            });

            await Task.WhenAll(tradeTask, quoteTask).ConfigureAwait(false);

            // Each stream advanced exactly its own count, untouched by the other.
            Assert.Equal((long)perStream, generator.Current(trade));
            Assert.Equal((long)perStream, generator.Current(quote));
        }
    }
}
