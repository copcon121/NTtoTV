using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck.Xunit;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Numbered correctness property for <see cref="SequenceGenerator"/> (task 4.4).
    ///
    ///     Feature: gc-chart-platform, Property 1: Per-stream sequence assignment is strictly monotonic
    ///     Validates: Requirements 1.3
    ///
    /// <para>For any interleaving of market-data events across arbitrary Streams
    /// (symbol, contract, channel), the sequence values assigned <i>within each
    /// single Stream</i> are strictly monotonic: the first is <c>1</c> and each
    /// subsequent value is exactly the previous value plus one. Streams are
    /// independent of one another — interleaving a Stream's events with events of
    /// any other Stream never perturbs its own 1..N progression. (Req 1.3;
    /// Glossary: Sequence, Stream)</para>
    ///
    /// <para>This is the numbered design property and is deliberately distinct
    /// from the example/edge-case unit tests in
    /// <see cref="SequenceGeneratorTests"/>.</para>
    ///
    /// <para>Generation strategy: FsCheck natively generates the <c>int[]</c>
    /// parameter; each element is mapped deterministically onto one Stream drawn
    /// from a small Stream universe that spans multiple symbols, contracts, and
    /// both channels. The resulting arbitrary-length, arbitrary-order event
    /// stream therefore exercises dense interleavings, single-Stream runs, and
    /// Streams that differ only by channel or only by contract — the exact
    /// independence boundaries Req 1.3 cares about — without a custom Arbitrary.</para>
    /// </summary>
    public class SequenceGeneratorPropertyTests
    {
        private const int Iterations = 200;

        /// <summary>
        /// A Stream universe spanning two symbols, multiple contracts, and both
        /// channels so generated interleavings cover Streams that are distinct
        /// only by channel ("GC 08-26" trade vs quote) and only by contract
        /// ("GC 08-26" vs "GC 10-26").
        /// </summary>
        private static readonly StreamId[] Universe =
        {
            new StreamId("GC", "GC 08-26", Channel.Trade),
            new StreamId("GC", "GC 08-26", Channel.Quote),
            new StreamId("GC", "GC 10-26", Channel.Trade),
            new StreamId("GC", "GC 10-26", Channel.Quote),
            new StreamId("GC", "GC 12-26", Channel.Trade),
            new StreamId("MGC", "MGC 08-26", Channel.Trade),
        };

        private static StreamId StreamFor(int seed) =>
            Universe[(int)((((long)seed % Universe.Length) + Universe.Length) % Universe.Length)];

        /// <summary>
        /// Property 1: across any interleaving of events over arbitrary Streams,
        /// each Stream's assigned sequences are exactly 1, 2, 3, ... in arrival
        /// order (strictly monotonic, step of one, starting at one), and each
        /// Stream's progression is independent of every other Stream.
        /// </summary>
        [Property(MaxTest = Iterations)]
        public bool PerStreamSequencesAreStrictlyMonotonicAndIndependent(int[]? seeds)
        {
            seeds ??= Array.Empty<int>();
            var generator = new SequenceGenerator();

            // Record, per Stream, the ordered values handed out as its events
            // arrive interleaved with every other Stream's events.
            var assignedByStream = new Dictionary<StreamId, List<long>>();

            foreach (var seed in seeds)
            {
                var stream = StreamFor(seed);
                var value = generator.NextSequence(stream);

                if (!assignedByStream.TryGetValue(stream, out var values))
                {
                    values = new List<long>();
                    assignedByStream[stream] = values;
                }

                values.Add(value);
            }

            foreach (var pair in assignedByStream)
            {
                var values = pair.Value;

                // Independence + strict monotonicity: regardless of how this
                // Stream's events were interleaved with others, its own values
                // must be precisely [1, 2, ..., count] with no gaps, no repeats,
                // and a strict +1 step.
                for (var i = 0; i < values.Count; i++)
                {
                    if (values[i] != i + 1)
                    {
                        return false;
                    }
                }

                // The non-mutating Current read agrees with the last issued value.
                if (generator.Current(pair.Key) != values.Count)
                {
                    return false;
                }
            }

            // Distinct Streams each tracked their own counter.
            return generator.StreamCount == assignedByStream.Count;
        }
    }
}
