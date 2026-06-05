using System;
using System.Collections.Concurrent;
using System.Threading;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Assigns monotonically increasing sequence numbers per <see cref="StreamId"/>
    /// — the tuple (symbol, contract, channel). Sequences are strictly monotonic
    /// within a single Stream and completely independent across Streams.
    /// (Req 1.3; Glossary: Sequence, Stream)
    ///
    /// <para>
    /// This generator is called from the NinjaTrader market-data callback path
    /// (the producer side of the Bounded_Queue), so it is designed to be:
    /// </para>
    /// <list type="bullet">
    ///   <item><description>
    ///   <b>Thread-safe</b>: NinjaTrader may deliver trade and quote callbacks on
    ///   different internal threads; concurrent <see cref="NextSequence(StreamId)"/>
    ///   calls — even for the same Stream — never produce a duplicate or a
    ///   non-monotonic value.
    ///   </description></item>
    ///   <item><description>
    ///   <b>Allocation-light</b>: after a Stream's counter is created on its first
    ///   event, the steady-state hot path performs a lock-free dictionary lookup
    ///   plus a single <see cref="Interlocked.Increment(ref long)"/> and allocates
    ///   nothing. The per-call value factory is a cached static delegate so the
    ///   <see cref="ConcurrentDictionary{TKey,TValue}.GetOrAdd(TKey, Func{TKey, TValue})"/>
    ///   call captures no closure.
    ///   </description></item>
    /// </list>
    ///
    /// <para>
    /// The first sequence issued for any Stream is <c>1</c>, and each subsequent
    /// call for that Stream returns exactly the previous value plus one.
    /// </para>
    /// </summary>
    public sealed class SequenceGenerator
    {
        /// <summary>
        /// Per-Stream counters. Keyed by <see cref="StreamId"/>, which provides
        /// value-equality and a stable hash so the same logical Stream always maps
        /// to the same counter regardless of <see cref="StreamId"/> identity.
        /// </summary>
        private readonly ConcurrentDictionary<StreamId, Counter> _counters =
            new ConcurrentDictionary<StreamId, Counter>();

        /// <summary>
        /// Cached factory so <see cref="ConcurrentDictionary{TKey,TValue}.GetOrAdd(TKey, Func{TKey, TValue})"/>
        /// does not allocate a closure on the slow (first-event-per-Stream) path.
        /// </summary>
        private static readonly Func<StreamId, Counter> CounterFactory = _ => new Counter();

        /// <summary>
        /// The number of distinct Streams that have been issued at least one
        /// sequence. Primarily useful for diagnostics and tests.
        /// </summary>
        public int StreamCount => _counters.Count;

        /// <summary>
        /// Returns the next sequence value for the given Stream, strictly greater
        /// than the previous value returned for that same Stream and independent of
        /// every other Stream. The first value returned for a Stream is <c>1</c>.
        /// (Req 1.3)
        /// </summary>
        /// <param name="streamId">The Stream (symbol, contract, channel) to advance.</param>
        /// <returns>The newly assigned, strictly increasing sequence value.</returns>
        public long NextSequence(StreamId streamId)
        {
            // Fast path: counter already exists for this Stream (the common case
            // after the first event). Avoids invoking the value factory entirely.
            Counter counter = _counters.TryGetValue(streamId, out Counter existing)
                ? existing
                : _counters.GetOrAdd(streamId, CounterFactory);

            // Atomic increment is the single point of mutation, so concurrent
            // callers for the same Stream are serialized without a lock and can
            // never observe or produce a duplicate value.
            return Interlocked.Increment(ref counter.Value);
        }

        /// <summary>
        /// Convenience overload that assigns the next sequence for the Stream
        /// identified by the given components, avoiding an explicit
        /// <see cref="StreamId"/> construction at the call site. (Req 1.3)
        /// </summary>
        /// <param name="symbol">User-facing symbol, e.g. "GC".</param>
        /// <param name="contract">Resolved real contract, e.g. "GC 08-26".</param>
        /// <param name="channel">The trade or quote channel.</param>
        /// <returns>The newly assigned, strictly increasing sequence value.</returns>
        public long NextSequence(string symbol, string contract, Channel channel) =>
            NextSequence(new StreamId(symbol, contract, channel));

        /// <summary>
        /// Returns the most recently issued sequence value for the given Stream,
        /// or <c>0</c> if no sequence has been issued for it yet. This is a
        /// non-mutating, atomic read and does not advance the counter.
        /// </summary>
        /// <param name="streamId">The Stream to inspect.</param>
        /// <returns>The last issued sequence value, or <c>0</c> when none.</returns>
        public long Current(StreamId streamId) =>
            _counters.TryGetValue(streamId, out Counter counter)
                ? Interlocked.Read(ref counter.Value)
                : 0L;

        /// <summary>
        /// Mutable holder for a single Stream's last-issued sequence value.
        /// A reference-type holder lets us mutate the value in place via
        /// <see cref="Interlocked"/> while the dictionary stores a stable
        /// reference, so the hot path never replaces dictionary entries.
        /// </summary>
        private sealed class Counter
        {
            /// <summary>
            /// The last issued sequence value for this Stream. <c>0</c> means no
            /// sequence has been issued yet; the first
            /// <see cref="Interlocked.Increment(ref long)"/> returns <c>1</c>.
            /// Mutated only through <see cref="Interlocked"/> to remain atomic on
            /// both 32- and 64-bit runtimes (NinjaTrader 8 targets .NET Framework
            /// 4.8, which may run as a 32-bit process).
            /// </summary>
            public long Value;
        }
    }
}
