using System;
using System.Collections.Generic;
using System.Threading;
using NtAddOn.Core.Configuration;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Core.Buffering
{
    /// <summary>
    /// The <c>Bounded_Queue</c>: a fixed-capacity, thread-safe buffer that sits
    /// between the NinjaTrader market-data callback (the single producer) and
    /// the background sender worker (the single consumer). (Design: Concurrency
    /// Model; Req 2.1-2.6)
    ///
    /// <para><b>Backpressure policy</b> (design "NT_AddOn: Thread Safety,
    /// Backpressure, and Queue Overload"):</para>
    /// <list type="bullet">
    ///   <item><description>
    ///     <b>Trades, below the critical-overload threshold</b>: every trade is
    ///     retained — never dropped (Req 2.4). "Below the threshold" means the
    ///     current depth is strictly less than
    ///     <see cref="CriticalOverloadThreshold"/>.
    ///   </description></item>
    ///   <item><description>
    ///     <b>Trades, at/above the critical-overload threshold</b>: the queue is
    ///     critically overloaded. To shed load while keeping the freshest tape,
    ///     the <i>oldest buffered trade</i> is dropped and logged
    ///     (drop-oldest-with-log) and the incoming trade is retained. Every
    ///     dropped trade is logged with its stream, sequence, and timestamp via
    ///     <see cref="IDroppedTradeLogger"/> so the dropped-trade log count
    ///     equals the number of dropped trades (Req 2.6).
    ///   </description></item>
    ///   <item><description>
    ///     <b>Quotes, below capacity</b>: enqueued normally (retained).
    ///   </description></item>
    ///   <item><description>
    ///     <b>Quotes, at capacity</b>: the queue keeps the latest quote for the
    ///     stream and discards the superseded one (coalesce, last-value-wins).
    ///     This overwrites the most recent buffered quote for that stream in
    ///     place, so quotes never push the queue past <see cref="Capacity"/>
    ///     (Req 2.5).
    ///   </description></item>
    /// </list>
    ///
    /// <para><b>Trade vs quote</b> is determined by the event's
    /// <see cref="StreamId.Channel"/> (<see cref="Channel.Trade"/> vs
    /// <see cref="Channel.Quote"/>), matching the glossary definition of a
    /// Stream as the tuple (symbol, contract, channel).</para>
    ///
    /// <para><b>Thread safety</b>: every operation is guarded by a single
    /// monitor lock and performs only O(1) bookkeeping — no IO, serialization,
    /// or compression — so <see cref="Enqueue"/> is safe and non-blocking to
    /// call directly on the NinjaTrader callback thread (Req 2.1-2.3). The
    /// consumer uses the blocking <see cref="Dequeue(CancellationToken)"/> (or
    /// the non-blocking <see cref="TryDequeue"/>).</para>
    ///
    /// <para><b>Integration note (parallel work)</b>: this queue depends only on
    /// the small <see cref="INormalizedEvent"/> abstraction rather than a
    /// concrete normalized-event type, because the normalization step (task 4.1)
    /// that produces those types is implemented in parallel with this queue
    /// (task 4.5). The normalized trade/quote types SHOULD implement
    /// <see cref="INormalizedEvent"/> so they can be buffered here without
    /// further changes.</para>
    /// </summary>
    public sealed class BoundedQueue
    {
        private readonly object _gate = new object();

        // Main FIFO buffer. Node references let us evict an interior trade
        // (drop-oldest) and overwrite a buffered quote (coalesce) in O(1).
        private readonly LinkedList<INormalizedEvent> _queue =
            new LinkedList<INormalizedEvent>();

        // Trade nodes in FIFO order, a subsequence of _queue. The front is the
        // oldest buffered trade (the drop-oldest victim). Kept consistent with
        // _queue on every enqueue/dequeue/evict.
        private readonly Queue<LinkedListNode<INormalizedEvent>> _tradeNodes =
            new Queue<LinkedListNode<INormalizedEvent>>();

        // Most-recent buffered quote node per quote stream, for O(1) coalescing.
        private readonly Dictionary<StreamId, LinkedListNode<INormalizedEvent>> _latestQuoteNode =
            new Dictionary<StreamId, LinkedListNode<INormalizedEvent>>();

        private readonly IDroppedTradeLogger _droppedTradeLogger;

        private long _droppedTradeCount;
        private long _coalescedQuoteCount;

        /// <summary>Fixed maximum number of buffered events (Req 2.5).</summary>
        public int Capacity { get; }

        /// <summary>
        /// Depth at/above which the queue is critically overloaded and trades
        /// may be dropped (Req 2.6). Below this depth every trade is retained
        /// (Req 2.4). Invariant: <c>1 &lt;= CriticalOverloadThreshold &lt;= Capacity</c>.
        /// </summary>
        public int CriticalOverloadThreshold { get; }

        /// <summary>
        /// Builds a Bounded_Queue using the capacity and critical-overload
        /// threshold from <see cref="AddOnConfig"/> (Req 2.4-2.6).
        /// </summary>
        /// <param name="config">AddOn configuration (capacity + threshold).</param>
        /// <param name="droppedTradeLogger">
        /// Sink for dropped-trade log entries; required so every dropped trade
        /// is recorded (Req 2.6).
        /// </param>
        public BoundedQueue(AddOnConfig config, IDroppedTradeLogger droppedTradeLogger)
            : this(
                (config ?? throw new ArgumentNullException(nameof(config))).QueueCapacity,
                config.CriticalOverloadThreshold,
                droppedTradeLogger)
        {
        }

        /// <summary>
        /// Builds a Bounded_Queue with explicit capacity and threshold. Used by
        /// tests and by the <see cref="AddOnConfig"/> constructor.
        /// </summary>
        /// <param name="capacity">Fixed capacity; must be &gt;= 1.</param>
        /// <param name="criticalOverloadThreshold">
        /// Critical-overload threshold; must be in the range
        /// <c>(0, capacity]</c>.
        /// </param>
        /// <param name="droppedTradeLogger">
        /// Sink for dropped-trade log entries (Req 2.6); must not be null.
        /// </param>
        public BoundedQueue(int capacity, int criticalOverloadThreshold, IDroppedTradeLogger droppedTradeLogger)
        {
            if (capacity < 1)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(capacity), capacity, "Queue capacity must be >= 1.");
            }

            if (criticalOverloadThreshold < 1 || criticalOverloadThreshold > capacity)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(criticalOverloadThreshold),
                    criticalOverloadThreshold,
                    "Critical-overload threshold must be in the range (0, capacity].");
            }

            Capacity = capacity;
            CriticalOverloadThreshold = criticalOverloadThreshold;
            _droppedTradeLogger = droppedTradeLogger
                ?? throw new ArgumentNullException(nameof(droppedTradeLogger));
        }

        /// <summary>Current number of buffered events.</summary>
        public int Count
        {
            get { lock (_gate) { return _queue.Count; } }
        }

        /// <summary>
        /// True when the queue is at/above <see cref="CriticalOverloadThreshold"/>
        /// (Req 2.4, 2.6).
        /// </summary>
        public bool IsCriticallyOverloaded
        {
            get { lock (_gate) { return _queue.Count >= CriticalOverloadThreshold; } }
        }

        /// <summary>
        /// Total number of trade events dropped due to critical overload. Equals
        /// the number of dropped-trade log entries written (Req 2.6, Property 3c).
        /// </summary>
        public long DroppedTradeCount
        {
            get { lock (_gate) { return _droppedTradeCount; } }
        }

        /// <summary>
        /// Total number of quote events coalesced (superseded by a later quote
        /// for the same stream at capacity) (Req 2.5, Property 3b).
        /// </summary>
        public long CoalescedQuoteCount
        {
            get { lock (_gate) { return _coalescedQuoteCount; } }
        }

        /// <summary>
        /// Enqueues a normalized event. Never blocks and performs only O(1)
        /// bookkeeping, so it is safe to call on the NinjaTrader market-data
        /// callback thread (Req 2.1-2.3).
        ///
        /// <para>Applies the backpressure policy described on the class:
        /// trades are retained below the critical-overload threshold (Req 2.4)
        /// and drop-oldest-with-log at/above it (Req 2.6); quotes coalesce
        /// last-value-wins at capacity (Req 2.5).</para>
        /// </summary>
        /// <param name="ev">The normalized event to buffer.</param>
        /// <returns>
        /// <c>true</c> when the incoming event is retained in the queue;
        /// <c>false</c> when the incoming event itself is dropped (an incoming
        /// trade dropped because the queue is full of un-evictable quotes, or an
        /// incoming quote dropped at capacity with no same-stream quote to
        /// coalesce).
        /// </returns>
        public bool Enqueue(INormalizedEvent ev)
        {
            if (ev == null)
            {
                throw new ArgumentNullException(nameof(ev));
            }

            lock (_gate)
            {
                bool retained = ev.Stream.Channel == Channel.Trade
                    ? EnqueueTrade(ev)
                    : EnqueueQuote(ev);

                if (retained)
                {
                    // Wake the consumer; a single background worker consumes,
                    // so waking one waiter is sufficient.
                    Monitor.Pulse(_gate);
                }

                return retained;
            }
        }

        // --- trade path (Req 2.4, 2.6) ------------------------------------

        private bool EnqueueTrade(INormalizedEvent trade)
        {
            // Below the critical-overload threshold: retain every trade (Req 2.4).
            if (_queue.Count < CriticalOverloadThreshold)
            {
                AppendTrade(trade);
                return true;
            }

            // Critically overloaded (Req 2.6).
            if (_tradeNodes.Count > 0)
            {
                // drop-oldest-with-log: evict the oldest buffered trade, log it,
                // and retain the incoming (freshest) trade. Net depth unchanged,
                // so the queue never exceeds Capacity.
                EvictOldestTradeAndLog();
                AppendTrade(trade);
                return true;
            }

            // No buffered trade to evict (queue is full of quotes).
            if (_queue.Count < Capacity)
            {
                // Physical room exists; retain the trade rather than drop it.
                AppendTrade(trade);
                return true;
            }

            // At capacity with no trade to evict: drop the incoming trade and
            // log it (Req 2.6).
            LogDroppedTrade(trade);
            return false;
        }

        private void AppendTrade(INormalizedEvent trade)
        {
            var node = _queue.AddLast(trade);
            _tradeNodes.Enqueue(node);
        }

        private void EvictOldestTradeAndLog()
        {
            var oldestTrade = _tradeNodes.Dequeue();
            _queue.Remove(oldestTrade);
            LogDroppedTrade(oldestTrade.Value);
        }

        private void LogDroppedTrade(INormalizedEvent trade)
        {
            _droppedTradeCount++;
            _droppedTradeLogger.LogDroppedTrade(trade.Stream, trade.Sequence, trade.TimestampMs);
        }

        // --- quote path (Req 2.5) -----------------------------------------

        private bool EnqueueQuote(INormalizedEvent quote)
        {
            // Below capacity: retain the quote and remember it as the latest
            // buffered quote for its stream.
            if (_queue.Count < Capacity)
            {
                var node = _queue.AddLast(quote);
                _latestQuoteNode[quote.Stream] = node;
                return true;
            }

            // At capacity: coalesce last-value-wins (Req 2.5). Overwrite the
            // most recent buffered quote for this stream in place, discarding
            // the superseded quote. Depth is unchanged, so capacity is honored.
            if (_latestQuoteNode.TryGetValue(quote.Stream, out var latest))
            {
                latest.Value = quote;
                _coalescedQuoteCount++;
                return true;
            }

            // At capacity with no same-stream quote to supersede: nothing to
            // coalesce and no room to grow, so drop the incoming quote. Quote
            // drops are not logged (Req 2.6 covers trade drops only).
            return false;
        }

        // --- consumer side -------------------------------------------------

        /// <summary>
        /// Removes and returns the oldest buffered event, blocking until one is
        /// available or <paramref name="cancellationToken"/> is canceled.
        /// Intended for the single background sender worker.
        /// </summary>
        /// <exception cref="OperationCanceledException">
        /// Thrown when the token is canceled while waiting.
        /// </exception>
        public INormalizedEvent Dequeue(CancellationToken cancellationToken)
        {
            // Waking on cancellation: the registered callback pulses the monitor
            // so a waiting consumer re-checks the token and throws.
            using (cancellationToken.Register(PulseAll))
            {
                lock (_gate)
                {
                    while (_queue.Count == 0)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        Monitor.Wait(_gate);
                    }

                    return DequeueHead();
                }
            }
        }

        /// <summary>
        /// Removes and returns the oldest buffered event, blocking indefinitely
        /// until one is available.
        /// </summary>
        public INormalizedEvent Dequeue() => Dequeue(CancellationToken.None);

        /// <summary>
        /// Attempts to remove the oldest buffered event without blocking.
        /// </summary>
        /// <param name="ev">The dequeued event, or <c>null</c> if empty.</param>
        /// <returns><c>true</c> if an event was dequeued; otherwise <c>false</c>.</returns>
        public bool TryDequeue(out INormalizedEvent? ev)
        {
            lock (_gate)
            {
                if (_queue.Count == 0)
                {
                    ev = null;
                    return false;
                }

                ev = DequeueHead();
                return true;
            }
        }

        // Assumes _gate is held and the queue is non-empty.
        private INormalizedEvent DequeueHead()
        {
            var node = _queue.First!;
            var ev = node.Value;
            _queue.RemoveFirst();

            if (ev.Stream.Channel == Channel.Trade)
            {
                // The head trade is the oldest event, hence the oldest trade and
                // therefore the front of _tradeNodes (FIFO invariant).
                _tradeNodes.Dequeue();
            }
            else
            {
                // Drop the latest-quote pointer only if it referenced this exact
                // node (older same-stream quotes leave it pointing elsewhere).
                if (_latestQuoteNode.TryGetValue(ev.Stream, out var latest) &&
                    ReferenceEquals(latest, node))
                {
                    _latestQuoteNode.Remove(ev.Stream);
                }
            }

            return ev;
        }

        private void PulseAll()
        {
            lock (_gate)
            {
                Monitor.PulseAll(_gate);
            }
        }
    }
}
