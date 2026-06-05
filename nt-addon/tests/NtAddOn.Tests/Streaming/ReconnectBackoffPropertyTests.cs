using System;
using FsCheck;
using FsCheck.Xunit;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Numbered correctness property for the pure <see cref="FibonacciBackoff"/>
    /// calculator that drives the NT_AddOn reconnect loop (task 4.9).
    ///
    ///     Feature: gc-chart-platform, Property 4: Reconnect backoff is Fibonacci-based, jittered within bounds, and capped at 60s
    ///     Validates: Requirements 3.1, 3.2, 3.3
    ///
    /// <para>Across arbitrary attempt indices and jitter samples, the backoff
    /// calculator simultaneously satisfies the three required behaviours:</para>
    /// <list type="bullet">
    ///   <item><description>
    ///     <b>(a) Fibonacci base (Req 3.1).</b> The un-jittered base delay equals
    ///     the Fibonacci sequence 1, 1, 2, 3, 5, 8, 13, … in whole seconds, with
    ///     each term capped at 60s. Verified against an independent reference
    ///     Fibonacci computation rather than the implementation's own algorithm.
    ///   </description></item>
    ///   <item><description>
    ///     <b>(b) Jitter within bounds (Req 3.2).</b> For a jitter sample in
    ///     <c>[0,1)</c>, the computed delay always lies within
    ///     <see cref="FibonacciBackoff.JitterBounds(int)"/>, is never below the
    ///     base delay (additive, non-negative jitter), and is never negative.
    ///   </description></item>
    ///   <item><description>
    ///     <b>(c) 60s cap (Req 3.3).</b> The computed delay never exceeds 60s no
    ///     matter how large the attempt index or jitter sample is — including
    ///     attempt indices large enough to overflow a naive Fibonacci.
    ///   </description></item>
    /// </list>
    ///
    /// <para>This is the numbered design property and is deliberately distinct
    /// from the example/edge-case unit tests in <see cref="FibonacciBackoffTests"/>.
    /// It runs at >= 100 iterations (MaxTest = 200) per the design Testing
    /// Strategy.</para>
    ///
    /// <para><b>Generation strategy.</b> A smart generator pairs an attempt index
    /// with a jitter sample. Attempt indices are drawn from three overlapping
    /// regimes — small indices that land on exact Fibonacci terms below the cap,
    /// the transition/capped region, and very large indices up to
    /// <see cref="int.MaxValue"/> (overflow safety) — so both the un-capped
    /// Fibonacci shape and the saturated cap are exercised. Jitter samples are
    /// uniform in <c>[0,1)</c>, the documented contract of
    /// <see cref="IRandomSource.NextDouble"/>, with the boundary value 0 (no
    /// jitter) included.</para>
    /// </summary>
    public class ReconnectBackoffPropertyTests
    {
        private const int Iterations = 200;
        private const double Tolerance = 1e-9;

        /// <summary>The required reconnect cap from Req 3.3.</summary>
        private const double CapSeconds = 60.0;

        /// <summary>One generated case: an attempt index and a jitter sample in [0,1).</summary>
        public sealed class BackoffCase
        {
            public BackoffCase(int attemptIndex, double jitterSample)
            {
                AttemptIndex = attemptIndex;
                JitterSample = jitterSample;
            }

            public int AttemptIndex { get; }

            public double JitterSample { get; }

            public override string ToString() =>
                $"attemptIndex={AttemptIndex}, jitterSample={JitterSample:R}";
        }

        /// <summary>
        /// Zero-based attempt indices spanning the exact-Fibonacci region, the
        /// cap transition, and very large (overflow-prone) indices.
        /// </summary>
        private static Gen<int> AttemptIndexGen() =>
            Gen.OneOf(
                Gen.Choose(0, 9),               // exact Fibonacci terms 1..55, below the cap
                Gen.Choose(0, 30),              // spans the 60s cap transition
                Gen.Choose(0, int.MaxValue));   // overflow-safety for the capped tail

        /// <summary>Uniform jitter sample in [0,1), including the 0 boundary (no jitter).</summary>
        private static Gen<double> JitterSampleGen() =>
            from n in Gen.Choose(0, 1_000_000 - 1)
            select n / 1_000_000.0;

        private static Arbitrary<BackoffCase> BackoffCaseArb() =>
            Arb.From(
                from attemptIndex in AttemptIndexGen()
                from jitterSample in JitterSampleGen()
                select new BackoffCase(attemptIndex, jitterSample));

        /// <summary>
        /// Independent reference: the Fibonacci sequence (F(0)=F(1)=1) in whole
        /// seconds, capped at <paramref name="capSeconds"/>. Computed with a
        /// distinct early-cap loop so it does not just mirror the implementation;
        /// the early cap also keeps it overflow-safe for huge indices.
        /// </summary>
        private static double ReferenceFibonacciCapped(int attemptIndex, double capSeconds)
        {
            if (attemptIndex <= 1)
            {
                return Math.Min(1.0, capSeconds);
            }

            long prev = 1; // F(0)
            long curr = 1; // F(1)
            for (var i = 2; i <= attemptIndex; i++)
            {
                long next = prev + curr;
                prev = curr;
                curr = next;
                if (curr >= capSeconds)
                {
                    return capSeconds;
                }
            }

            return Math.Min((double)curr, capSeconds);
        }

        /// <summary>
        /// Feature: gc-chart-platform, Property 4: Reconnect backoff is
        /// Fibonacci-based, jittered within bounds, and capped at 60s.
        /// Validates: Requirements 3.1, 3.2, 3.3.
        /// </summary>
        [Property(MaxTest = Iterations)]
        public Property ReconnectBackoff_IsFibonacciJitteredWithinBoundsAndCappedAt60s()
        {
            return Prop.ForAll(BackoffCaseArb(), c =>
            {
                // Default backoff matches the requirements: 60s cap (Req 3.3) and
                // 20% additive jitter (Req 3.2).
                var backoff = new FibonacciBackoff();

                var baseSeconds = backoff.BaseDelaySeconds(c.AttemptIndex);

                // (a) Req 3.1: the un-jittered base equals the capped Fibonacci
                // sequence, checked against an independent reference.
                var expectedBase = ReferenceFibonacciCapped(c.AttemptIndex, CapSeconds);
                var baseMatchesFibonacci = Math.Abs(baseSeconds - expectedBase) <= Tolerance;

                var (min, max) = backoff.JitterBounds(c.AttemptIndex);
                var delaySeconds = backoff.ComputeDelay(c.AttemptIndex, c.JitterSample).TotalSeconds;

                // (b) Req 3.2: the jittered delay is within the inclusive jitter
                // bounds, never below the base, and never negative.
                var withinJitterBounds =
                    delaySeconds >= min.TotalSeconds - Tolerance &&
                    delaySeconds <= max.TotalSeconds + Tolerance;
                var neverBelowBase = delaySeconds >= baseSeconds - Tolerance;
                var nonNegative = delaySeconds >= -Tolerance;

                // (c) Req 3.3: the delay never exceeds the 60s cap, regardless of
                // attempt index or jitter sample.
                var neverExceedsCap = delaySeconds <= CapSeconds + Tolerance;

                return (baseMatchesFibonacci && withinJitterBounds && neverBelowBase && nonNegative && neverExceedsCap)
                    .Label($"base={baseSeconds} expectedBase={expectedBase} delay={delaySeconds} " +
                           $"bounds=[{min.TotalSeconds},{max.TotalSeconds}] cap={CapSeconds} ({c})");
            });
        }
    }
}
