using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Pure, deterministic calculator for reconnect backoff delays (Req 3.1–3.3).
    ///
    /// <para>
    /// This type contains <b>no waiting and no IO</b>: it only computes a delay
    /// from an attempt index and a jitter sample. The async waiting lives in
    /// <see cref="ReconnectLoop"/>. Factoring the calculation out as a pure
    /// function makes the three required behaviours independently inspectable
    /// and property-testable without real time passing (Property 4, task 4.9):
    /// </para>
    /// <list type="number">
    ///   <item><description>
    ///     <b>Fibonacci base</b> — the un-jittered delay follows the sequence
    ///     1s, 1s, 2s, 3s, 5s, 8s, 13s, … (Req 3.1). See
    ///     <see cref="BaseDelaySeconds(int)"/>.
    ///   </description></item>
    ///   <item><description>
    ///     <b>Randomized jitter</b> — a non-negative amount, up to
    ///     <see cref="JitterFraction"/> of the base delay, is added (Req 3.2).
    ///     The amount is derived from an injected sample in <c>[0,1)</c> so it
    ///     is deterministic under test. The inclusive bounds are exposed by
    ///     <see cref="JitterBounds(int)"/>.
    ///   </description></item>
    ///   <item><description>
    ///     <b>60s cap</b> — the final delay is never greater than
    ///     <see cref="CapSeconds"/> (default 60s) no matter how large the base
    ///     or the jitter (Req 3.3). See <see cref="ComputeDelay(int, double)"/>.
    ///   </description></item>
    /// </list>
    ///
    /// <para>
    /// The base, jitter strategy, and cap are all explicit constructor
    /// parameters / public properties so callers and tests can inspect them
    /// directly rather than reverse-engineering them from observed delays.
    /// </para>
    /// </summary>
    public sealed class FibonacciBackoff
    {
        /// <summary>Default cap for reconnect delays: 60 seconds (Req 3.3).</summary>
        public const double DefaultCapSeconds = 60.0;

        /// <summary>
        /// Default jitter fraction: the added jitter is between 0 and 20% of the
        /// base Fibonacci delay (Req 3.2). Additive, non-negative jitter keeps
        /// the recognizable Fibonacci shape while de-synchronizing reconnect
        /// storms across instances.
        /// </summary>
        public const double DefaultJitterFraction = 0.2;

        /// <summary>
        /// The maximum reconnect delay in seconds. The computed delay
        /// (base + jitter) is clamped to this value (Req 3.3).
        /// </summary>
        public double CapSeconds { get; }

        /// <summary>
        /// Fraction of the base delay that bounds the additive jitter: the
        /// jitter added for an attempt lies in
        /// <c>[0, JitterFraction * baseDelay]</c> (Req 3.2). A value of <c>0</c>
        /// disables jitter (deterministic Fibonacci delays).
        /// </summary>
        public double JitterFraction { get; }

        /// <summary>The reconnect delay cap as a <see cref="TimeSpan"/>.</summary>
        public TimeSpan Cap => TimeSpan.FromSeconds(CapSeconds);

        /// <summary>
        /// Creates a backoff calculator. Defaults match the requirements: a
        /// 60-second cap (Req 3.3) and 20% additive jitter (Req 3.2).
        /// </summary>
        /// <param name="capSeconds">
        /// Maximum delay in seconds; must be &gt; 0. Defaults to
        /// <see cref="DefaultCapSeconds"/> (60s).
        /// </param>
        /// <param name="jitterFraction">
        /// Upper bound of additive jitter as a fraction of the base delay; must
        /// be &gt;= 0. Defaults to <see cref="DefaultJitterFraction"/> (0.2).
        /// </param>
        public FibonacciBackoff(
            double capSeconds = DefaultCapSeconds,
            double jitterFraction = DefaultJitterFraction)
        {
            if (capSeconds <= 0 || double.IsNaN(capSeconds) || double.IsInfinity(capSeconds))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(capSeconds), capSeconds, "Cap must be a positive, finite number of seconds.");
            }

            if (jitterFraction < 0 || double.IsNaN(jitterFraction) || double.IsInfinity(jitterFraction))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(jitterFraction), jitterFraction, "Jitter fraction must be a finite value >= 0.");
            }

            CapSeconds = capSeconds;
            JitterFraction = jitterFraction;
        }

        /// <summary>
        /// Returns the raw Fibonacci value (in whole seconds) for the given
        /// zero-based attempt index, following 1, 1, 2, 3, 5, 8, 13, … (Req 3.1).
        /// The result is clamped to <see cref="CapSeconds"/>: once the sequence
        /// reaches or exceeds the cap it stays at the cap, which also avoids any
        /// integer overflow for large indices.
        /// </summary>
        /// <param name="attemptIndex">Zero-based attempt index (0 = first retry).</param>
        /// <returns>The capped Fibonacci base delay in seconds.</returns>
        public double BaseDelaySeconds(int attemptIndex)
        {
            if (attemptIndex < 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(attemptIndex), attemptIndex, "Attempt index must be >= 0.");
            }

            // F(0)=1, F(1)=1, F(n)=F(n-1)+F(n-2). Iterative, with an early cap so
            // the running value can never overflow long before being clamped.
            long capCeil = (long)Math.Ceiling(CapSeconds);

            if (attemptIndex <= 1)
            {
                return Math.Min(1.0, CapSeconds);
            }

            long a = 1; // F(0)
            long b = 1; // F(1)
            for (int i = 2; i <= attemptIndex; i++)
            {
                long next = a + b;
                a = b;
                b = next;
                if (b >= capCeil)
                {
                    return CapSeconds;
                }
            }

            return Math.Min((double)b, CapSeconds);
        }

        /// <summary>
        /// Returns the un-jittered base delay for the attempt as a
        /// <see cref="TimeSpan"/> (Req 3.1, capped per Req 3.3).
        /// </summary>
        public TimeSpan BaseDelay(int attemptIndex) =>
            TimeSpan.FromSeconds(BaseDelaySeconds(attemptIndex));

        /// <summary>
        /// Returns the inclusive lower and upper bounds of the delay that
        /// <see cref="ComputeDelay(int, double)"/> can produce for the given
        /// attempt, after jitter and the cap are applied (Req 3.2, 3.3). Useful
        /// for asserting in tests that a computed delay falls within bounds.
        ///
        /// <para>The lower bound is the (capped) base delay; the upper bound is
        /// the base delay plus maximum jitter, clamped to the cap.</para>
        /// </summary>
        /// <param name="attemptIndex">Zero-based attempt index.</param>
        /// <returns>A tuple of (minimum, maximum) achievable delays.</returns>
        public (TimeSpan Min, TimeSpan Max) JitterBounds(int attemptIndex)
        {
            double baseSeconds = BaseDelaySeconds(attemptIndex);
            double minSeconds = Math.Min(baseSeconds, CapSeconds);
            double maxSeconds = Math.Min(baseSeconds * (1.0 + JitterFraction), CapSeconds);
            return (TimeSpan.FromSeconds(minSeconds), TimeSpan.FromSeconds(maxSeconds));
        }

        /// <summary>
        /// Computes the reconnect delay for an attempt from a deterministic
        /// jitter sample. This is the pure core used by both production code
        /// (via the <see cref="IRandomSource"/> overload) and tests.
        ///
        /// <para>The delay is <c>min(baseDelay + sample * JitterFraction *
        /// baseDelay, cap)</c>: the Fibonacci base (Req 3.1) plus non-negative
        /// jitter bounded by <see cref="JitterFraction"/> (Req 3.2), clamped to
        /// <see cref="CapSeconds"/> (Req 3.3). The result is always within
        /// <see cref="JitterBounds(int)"/> and never negative.</para>
        /// </summary>
        /// <param name="attemptIndex">Zero-based attempt index (0 = first retry).</param>
        /// <param name="jitterSample">
        /// Uniform jitter sample in <c>[0, 1)</c> (the contract of
        /// <see cref="IRandomSource.NextDouble"/>). Values are clamped into
        /// <c>[0, 1]</c> defensively so an out-of-range sample can never push
        /// the delay outside its bounds.
        /// </param>
        /// <returns>The reconnect delay, capped at <see cref="CapSeconds"/>.</returns>
        public TimeSpan ComputeDelay(int attemptIndex, double jitterSample)
        {
            double baseSeconds = BaseDelaySeconds(attemptIndex);

            // Defensive clamp: NextDouble() is documented as [0,1), but guard so
            // jitter is always non-negative and within the declared bounds.
            double sample = jitterSample;
            if (double.IsNaN(sample) || sample < 0.0)
            {
                sample = 0.0;
            }
            else if (sample > 1.0)
            {
                sample = 1.0;
            }

            double jitterSeconds = sample * JitterFraction * baseSeconds;
            double totalSeconds = baseSeconds + jitterSeconds;
            double cappedSeconds = Math.Min(totalSeconds, CapSeconds);
            return TimeSpan.FromSeconds(cappedSeconds);
        }

        /// <summary>
        /// Computes the reconnect delay for an attempt, drawing the jitter
        /// sample from the injected <paramref name="random"/> source (Req 3.2).
        /// Delegates to the pure <see cref="ComputeDelay(int, double)"/>.
        /// </summary>
        /// <param name="attemptIndex">Zero-based attempt index (0 = first retry).</param>
        /// <param name="random">Jitter source; must not be null.</param>
        /// <returns>The reconnect delay, capped at <see cref="CapSeconds"/>.</returns>
        public TimeSpan ComputeDelay(int attemptIndex, IRandomSource random)
        {
            if (random == null)
            {
                throw new ArgumentNullException(nameof(random));
            }

            return ComputeDelay(attemptIndex, random.NextDouble());
        }
    }
}
