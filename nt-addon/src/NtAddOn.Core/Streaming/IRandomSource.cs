namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Injectable source of uniform random samples in the half-open interval
    /// <c>[0, 1)</c>, used to add randomized jitter to reconnect backoff delays
    /// (Req 3.2).
    ///
    /// <para>
    /// The random source is a <b>seam</b> so that the jitter applied by
    /// <see cref="FibonacciBackoff"/> and the <see cref="ReconnectLoop"/> can be
    /// made fully deterministic in tests (Property 4, task 4.9). Production code
    /// uses <see cref="SystemRandomSource"/>; property/unit tests supply a fake
    /// that returns chosen samples (e.g. 0.0 for the lower jitter bound and a
    /// value approaching 1.0 for the upper bound) so the Fibonacci base, the
    /// jitter bounds, and the 60s cap can all be asserted without real waiting
    /// or nondeterminism.
    /// </para>
    /// </summary>
    public interface IRandomSource
    {
        /// <summary>
        /// Returns a uniform random sample in the half-open interval
        /// <c>[0.0, 1.0)</c>. Callers (notably <see cref="FibonacciBackoff"/>)
        /// scale this sample into the jitter range for an attempt.
        /// </summary>
        double NextDouble();
    }
}
