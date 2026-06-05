using System;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Unit tests (specific examples + edge cases) for the pure
    /// <see cref="FibonacciBackoff"/> calculator used by the NT_AddOn reconnect
    /// loop (task 4.8, Req 3.1–3.3).
    ///
    /// These are example-based unit tests. The universal Property 4 test
    /// (Fibonacci base / jitter bounds / 60s cap across all inputs) is a
    /// separate task (4.9) and is intentionally not implemented here.
    /// </summary>
    public class FibonacciBackoffTests
    {
        private const double Tolerance = 1e-9;

        [Theory]
        [InlineData(0, 1.0)]   // F(0) = 1s (Req 3.1)
        [InlineData(1, 1.0)]   // F(1) = 1s
        [InlineData(2, 2.0)]
        [InlineData(3, 3.0)]
        [InlineData(4, 5.0)]
        [InlineData(5, 8.0)]
        [InlineData(6, 13.0)]
        [InlineData(7, 21.0)]
        [InlineData(8, 34.0)]
        [InlineData(9, 55.0)]
        public void BaseDelay_FollowsFibonacciSequence(int attemptIndex, double expectedSeconds)
        {
            double actual = new FibonacciBackoff().BaseDelaySeconds(attemptIndex);
            Assert.Equal(expectedSeconds, actual, precision: 9);
        }

        [Theory]
        [InlineData(10)] // F = 89 > 60 -> capped
        [InlineData(11)] // F = 144 > 60 -> capped
        [InlineData(50)] // far beyond cap, must not overflow
        [InlineData(1000)]
        public void BaseDelay_IsCappedAtSixtySeconds(int attemptIndex)
        {
            // Req 3.3: once the Fibonacci value reaches/exceeds the cap it stays
            // at 60s; large indices must not overflow.
            double actual = new FibonacciBackoff().BaseDelaySeconds(attemptIndex);
            Assert.Equal(FibonacciBackoff.DefaultCapSeconds, actual, precision: 9);
        }

        [Fact]
        public void ComputeDelay_WithZeroSample_EqualsBaseDelay()
        {
            // Req 3.2: minimum jitter (sample 0) leaves the base delay unchanged.
            var backoff = new FibonacciBackoff();

            var delay = backoff.ComputeDelay(attemptIndex: 4, jitterSample: 0.0);

            Assert.Equal(5.0, delay.TotalSeconds, precision: 9);
        }

        [Fact]
        public void ComputeDelay_WithMaxSample_AddsFullJitterBelowCap()
        {
            // Req 3.2: a sample approaching 1 adds the full jitter fraction.
            var backoff = new FibonacciBackoff(); // 20% jitter

            // attempt 4 -> base 5s, max jitter 1s -> ~6s, well below the 60s cap.
            var delay = backoff.ComputeDelay(attemptIndex: 4, jitterSample: 1.0);

            Assert.Equal(6.0, delay.TotalSeconds, precision: 9);
        }

        [Fact]
        public void ComputeDelay_NeverExceedsCap_EvenWithMaxJitter()
        {
            // Req 3.3: base + jitter is clamped to 60s.
            var backoff = new FibonacciBackoff();

            var delay = backoff.ComputeDelay(attemptIndex: 9, jitterSample: 1.0); // base 55s + 11s jitter = 66s

            Assert.Equal(FibonacciBackoff.DefaultCapSeconds, delay.TotalSeconds, precision: 9);
        }

        [Theory]
        [InlineData(-0.5)] // below the documented [0,1) range
        [InlineData(2.0)]  // above the documented [0,1) range
        [InlineData(double.NaN)]
        public void ComputeDelay_ClampsOutOfRangeSampleIntoBounds(double sample)
        {
            var backoff = new FibonacciBackoff();
            var (min, max) = backoff.JitterBounds(4);

            var delay = backoff.ComputeDelay(attemptIndex: 4, jitterSample: sample);

            Assert.InRange(delay.TotalSeconds, min.TotalSeconds - Tolerance, max.TotalSeconds + Tolerance);
        }

        [Fact]
        public void JitterBounds_MinIsBase_MaxIsBasePlusJitterCapped()
        {
            var backoff = new FibonacciBackoff();

            var (min, max) = backoff.JitterBounds(4); // base 5s
            Assert.Equal(5.0, min.TotalSeconds, precision: 9);
            Assert.Equal(6.0, max.TotalSeconds, precision: 9);

            var (minCapped, maxCapped) = backoff.JitterBounds(9); // base 55s, +11s -> capped 60s
            Assert.Equal(55.0, minCapped.TotalSeconds, precision: 9);
            Assert.Equal(60.0, maxCapped.TotalSeconds, precision: 9);
        }

        [Fact]
        public void ComputeDelay_DrawsSampleFromInjectedRandomSource()
        {
            var backoff = new FibonacciBackoff();
            var random = new FixedRandomSource(0.5);

            var delay = backoff.ComputeDelay(attemptIndex: 4, random); // base 5s + 0.5*0.2*5 = 0.5s

            Assert.Equal(5.5, delay.TotalSeconds, precision: 9);
        }

        [Fact]
        public void ZeroJitterFraction_ProducesDeterministicFibonacciDelays()
        {
            var backoff = new FibonacciBackoff(jitterFraction: 0.0);

            // No jitter regardless of the sample (Req 3.2 with jitter disabled).
            Assert.Equal(5.0, backoff.ComputeDelay(4, 1.0).TotalSeconds, precision: 9);
            Assert.Equal(5.0, backoff.ComputeDelay(4, 0.0).TotalSeconds, precision: 9);
        }

        [Fact]
        public void Constructor_RejectsInvalidArguments()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => new FibonacciBackoff(capSeconds: 0));
            Assert.Throws<ArgumentOutOfRangeException>(() => new FibonacciBackoff(capSeconds: -1));
            Assert.Throws<ArgumentOutOfRangeException>(() => new FibonacciBackoff(jitterFraction: -0.1));
        }

        [Fact]
        public void BaseDelay_RejectsNegativeAttemptIndex()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => new FibonacciBackoff().BaseDelaySeconds(-1));
        }

        /// <summary>Deterministic <see cref="IRandomSource"/> for tests.</summary>
        private sealed class FixedRandomSource : IRandomSource
        {
            private readonly double _value;
            public FixedRandomSource(double value) => _value = value;
            public double NextDouble() => _value;
        }
    }
}
