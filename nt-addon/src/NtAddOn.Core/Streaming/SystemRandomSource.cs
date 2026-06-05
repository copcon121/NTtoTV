using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Production <see cref="IRandomSource"/> backed by a <see cref="Random"/>
    /// instance, used to produce the randomized jitter added to reconnect
    /// backoff delays (Req 3.2).
    ///
    /// <para><b>Thread-safety.</b> <see cref="Random"/> is not thread-safe, but
    /// the reconnect loop is driven by the single background sender worker
    /// (design Concurrency Model), so jitter sampling happens on one thread.
    /// This type therefore does not add synchronization; do not share a single
    /// instance across threads.</para>
    /// </summary>
    public sealed class SystemRandomSource : IRandomSource
    {
        private readonly Random _random;

        /// <summary>
        /// Creates a source seeded nondeterministically (time-based), suitable
        /// for production where independent AddOn instances should not share a
        /// jitter sequence.
        /// </summary>
        public SystemRandomSource()
            : this(new Random())
        {
        }

        /// <summary>
        /// Creates a source with an explicit seed. Useful for reproducing a
        /// particular jitter sequence in diagnostics.
        /// </summary>
        /// <param name="seed">Seed forwarded to <see cref="Random"/>.</param>
        public SystemRandomSource(int seed)
            : this(new Random(seed))
        {
        }

        /// <summary>
        /// Creates a source wrapping an existing <see cref="Random"/>.
        /// </summary>
        /// <param name="random">The backing random generator; must not be null.</param>
        public SystemRandomSource(Random random)
        {
            _random = random ?? throw new ArgumentNullException(nameof(random));
        }

        /// <inheritdoc />
        public double NextDouble() => _random.NextDouble();
    }
}
