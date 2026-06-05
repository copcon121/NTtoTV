using FsCheck.Xunit;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests
{
    /// <summary>
    /// Smoke test that verifies the FsCheck property-based testing harness is
    /// wired up and runs at the required >= 100 iterations. This is scaffolding
    /// (design Testing Strategy: SMOKE) for task 1.3, NOT one of the numbered
    /// correctness Properties 1-31 — those are implemented by their own tasks
    /// (e.g. Property 1 in task 4.4, Property 3 in task 4.6, Property 4 in
    /// task 4.9) using the tag format:
    ///     Feature: gc-chart-platform, Property {n}: {text}
    /// </summary>
    public class PropertyTestHarnessSmokeTests
    {
        // MaxTest = 100 demonstrates the >= 100 iteration requirement is honored.
        [Property(MaxTest = 100)]
        public bool StreamId_ValueEquality_IsReflexive(string symbol, string contract, bool isTrade)
        {
            var channel = isTrade ? Channel.Trade : Channel.Quote;
            var a = new StreamId(symbol ?? "GC", contract ?? "GC 08-26", channel);
            var b = new StreamId(symbol ?? "GC", contract ?? "GC 08-26", channel);

            return a.Equals(b) && a.GetHashCode() == b.GetHashCode();
        }

        [Fact]
        public void Harness_IsAvailable()
        {
            // Trivial assertion proving xUnit + project references resolve.
            Assert.Equal(Channel.Trade, new StreamId("GC", "GC 08-26", Channel.Trade).Channel);
        }
    }
}
