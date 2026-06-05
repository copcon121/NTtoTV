using System;
using System.Collections.Generic;
using FsCheck;
using FsCheck.Xunit;
using NtAddOn.Core.MarketData;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.MarketData
{
    /// <summary>
    /// Numbered correctness property for task 4.2.
    ///
    ///     Feature: gc-chart-platform, Property 2: Forwarded events are tagged with their originating contract
    ///
    /// Design (Property 2): "For any normalized event built from a given
    /// Candidate_Contract source, the <c>contract</c> field of the forwarded
    /// message equals that source contract." (Validates: Requirements 1.6)
    ///
    /// <para>This is the single numbered property test for Property 2. It is
    /// complementary to — and deliberately distinct from — the example-based
    /// <see cref="MarketDataNormalizerTests"/>. It runs at >= 100 iterations
    /// (MaxTest = 200) per the design Testing Strategy.</para>
    ///
    /// <para>Generation strategy: a smart generator produces a sequence of event
    /// specs, each pairing an <em>originating contract</em> with a trade/quote
    /// channel. Contracts are drawn from a realistic GC candidate universe biased
    /// 2:1 against FsCheck's arbitrary string generator, so tagging is exercised
    /// both across the realistic Candidate_Contract space AND adversarial
    /// identifiers (special characters, unicode, long strings). Generated
    /// contracts are always non-empty / non-whitespace because
    /// <see cref="NormalizedEvent"/> requires a taggable contract (Req 1.6); an
    /// empty/whitespace draw deterministically falls back to the universe.</para>
    /// </summary>
    public class MarketDataContractTaggingPropertyTests
    {
        private const int Iterations = 200;

        /// <summary>Realistic GC Candidate_Contract identifiers.</summary>
        private static readonly string[] ContractUniverse =
        {
            "GC 02-26", "GC 04-26", "GC 06-26", "GC 08-26",
            "GC 10-26", "GC 12-26", "GC 02-27",
        };

        /// <summary>Captures every enqueued (forwarded) event for assertions.</summary>
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
        /// real implementation; the contract-tagging property is independent of
        /// the sequence values it produces.
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

        /// <summary>One generated event: its originating contract and channel.</summary>
        public sealed class EventSpec
        {
            public EventSpec(string contract, bool isTrade)
            {
                Contract = contract;
                IsTrade = isTrade;
            }

            public string Contract { get; }

            public bool IsTrade { get; }
        }

        private static Gen<string> ContractGen() =>
            from useUniverse in Gen.Elements(true, true, false)
            from idx in Gen.Choose(0, ContractUniverse.Length - 1)
            from raw in Arb.Default.String().Generator
            select (useUniverse || string.IsNullOrWhiteSpace(raw)) ? ContractUniverse[idx] : raw;

        private static Gen<EventSpec> EventSpecGen() =>
            from contract in ContractGen()
            from isTrade in Gen.Elements(true, false)
            select new EventSpec(contract, isTrade);

        private static Arbitrary<EventSpec[]> EventSpecsArb() =>
            Arb.From(Gen.ArrayOf(EventSpecGen()));

        /// <summary>
        /// Feature: gc-chart-platform, Property 2: Forwarded events are tagged
        /// with their originating contract.
        ///
        /// For any sequence of normalized trade/quote events produced for
        /// arbitrary originating Candidate_Contracts, each forwarded/enqueued
        /// event carries the exact contract identifier it originated from, in the
        /// order produced. (Validates: Requirements 1.6)
        /// </summary>
        [Property(MaxTest = Iterations)]
        public Property ForwardedEvents_AreTaggedWithOriginatingContract()
        {
            return Prop.ForAll(EventSpecsArb(), specs =>
            {
                var sink = new CapturingSink();
                var normalizer = new MarketDataNormalizer("GC", new FakeSequenceSource(), sink);

                var expectedContracts = new List<string>(specs.Length);

                for (var i = 0; i < specs.Length; i++)
                {
                    var spec = specs[i];

                    if (spec.IsTrade)
                    {
                        normalizer.NormalizeTrade(
                            contract: spec.Contract,
                            time: 1_730_313_600_000L + i,
                            price: 2345.0 + (i % 10) * 0.1,
                            volume: 1 + (i % 5),
                            bid: 2344.9,
                            ask: 2345.1,
                            bestBid: 2344.9,
                            bestAsk: 2345.1);
                    }
                    else
                    {
                        normalizer.NormalizeQuote(
                            contract: spec.Contract,
                            time: 1_730_313_600_000L + i,
                            bid: 2344.9,
                            ask: 2345.1,
                            bidSize: 1 + (i % 7),
                            askSize: 1 + (i % 3));
                    }

                    expectedContracts.Add(spec.Contract);
                }

                // Every produced event was forwarded (enqueued) exactly once...
                if (sink.Events.Count != expectedContracts.Count)
                {
                    return false;
                }

                // ...and each forwarded event carries the contract it originated
                // from, verbatim and in order (Req 1.6).
                for (var i = 0; i < expectedContracts.Count; i++)
                {
                    if (!string.Equals(sink.Events[i].Contract, expectedContracts[i], StringComparison.Ordinal))
                    {
                        return false;
                    }
                }

                return true;
            });
        }
    }
}
