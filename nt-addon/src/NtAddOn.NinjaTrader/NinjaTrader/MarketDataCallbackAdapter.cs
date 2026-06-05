#if NT8
// This file is compiled ONLY when the NinjaTrader 8 assemblies are available
// (see NtAddOn.NinjaTrader.csproj). It is the thin NinjaTrader-coupled adapter
// that turns raw Level 1 market-data callbacks into NtAddOn.Core normalized
// events.
//
// Task 4.1 responsibility: the callback path does normalize + tag contract +
// enqueue ONLY (Req 1.1, 1.2, 1.6, 2.1, 2.3). It performs NO network IO, file
// IO, JSON serialization, or compression — all of that runs later on the
// background worker (task 4.7). Per-stream sequence assignment (task 4.3) and
// the Bounded_Queue (task 4.5) are injected seams from NtAddOn.Core.

using System;
using System.Collections.Concurrent;
using NinjaTrader.Data;
using NtAddOn.Core.MarketData;
using NtAddOn.Core.Streaming;

namespace NtAddOn.NinjaTrader
{
    /// <summary>
    /// Adapts NinjaTrader 8 Level 1 market-data callbacks into normalized
    /// trade/quote events. One adapter instance serves all subscribed
    /// Candidate_Contracts for a single user-facing symbol (e.g. "GC").
    ///
    /// The NinjaTrader subscription wiring (subscribe on start / Control_Command
    /// subscribe-unsubscribe) is implemented in task 4.10 and calls
    /// <see cref="OnMarketData"/> for each event, passing the originating
    /// Candidate_Contract so the event can be tagged with it (Req 1.6).
    ///
    /// NinjaTrader serializes market-data callbacks per subscribed instrument,
    /// so updates to a single contract's quote snapshot are not racy; the
    /// per-contract snapshot map is concurrent to tolerate multiple contracts
    /// firing on different threads.
    /// </summary>
    public sealed class MarketDataCallbackAdapter
    {
        private readonly MarketDataNormalizer _normalizer;
        private readonly ConcurrentDictionary<string, QuoteSnapshot> _snapshots =
            new ConcurrentDictionary<string, QuoteSnapshot>(StringComparer.Ordinal);

        /// <summary>
        /// Creates the adapter. <paramref name="symbol"/> is the user-facing
        /// symbol applied to every event; <paramref name="sequenceSource"/> and
        /// <paramref name="sink"/> are the Core seams (task 4.3 / task 4.5).
        /// </summary>
        public MarketDataCallbackAdapter(string symbol, ISequenceSource sequenceSource, IEventSink sink)
        {
            _normalizer = new MarketDataNormalizer(symbol, sequenceSource, sink);
        }

        /// <summary>
        /// NinjaTrader Level 1 market-data callback. Runs on a NinjaTrader
        /// market-data thread and MUST stay non-blocking: it only reads the
        /// event's primitive values, updates the per-contract quote snapshot,
        /// and normalizes + enqueues (Req 2.1, 2.3).
        /// </summary>
        /// <param name="contract">
        /// The originating Candidate_Contract identifier (e.g. "GC 08-26") the
        /// subscription was created for; used to tag the event (Req 1.6).
        /// </param>
        /// <param name="e">The NinjaTrader market-data event args.</param>
        public void OnMarketData(string contract, MarketDataEventArgs e)
        {
            if (e == null || string.IsNullOrEmpty(contract))
            {
                return;
            }

            // NinjaTrader delivers market-data times in the instrument's
            // exchange/local zone (DateTimeKind is typically Unspecified).
            // Convert to a UTC instant before producing the Canonical_Timestamp
            // (ms since Unix epoch UTC). (Glossary: Canonical_Timestamp)
            var timeMs = CanonicalTimestamp.FromDateTime(e.Time.ToUniversalTime());
            var snapshot = _snapshots.GetOrAdd(contract, _ => new QuoteSnapshot());

            switch (e.MarketDataType)
            {
                case MarketDataType.Last:
                    // Trade print: attach the most recent quote snapshot so the
                    // Backend's parity logic sees the bid/ask state as observed
                    // at the print (Req 1.1).
                    _normalizer.NormalizeTrade(
                        contract,
                        timeMs,
                        e.Price,
                        e.Volume,
                        snapshot.Bid,
                        snapshot.Ask,
                        snapshot.Bid,
                        snapshot.Ask);
                    break;

                case MarketDataType.Bid:
                    snapshot.Bid = e.Price;
                    snapshot.BidSize = e.Volume;
                    _normalizer.NormalizeQuote(
                        contract,
                        timeMs,
                        snapshot.Bid ?? e.Price,
                        snapshot.Ask ?? e.Price,
                        snapshot.BidSize,
                        snapshot.AskSize);
                    break;

                case MarketDataType.Ask:
                    snapshot.Ask = e.Price;
                    snapshot.AskSize = e.Volume;
                    _normalizer.NormalizeQuote(
                        contract,
                        timeMs,
                        snapshot.Bid ?? e.Price,
                        snapshot.Ask ?? e.Price,
                        snapshot.BidSize,
                        snapshot.AskSize);
                    break;

                // Other MarketDataType values (DailyHigh, DailyLow, etc.) are not
                // part of the Level 1 trade/quote feed this bridge forwards.
                default:
                    break;
            }
        }

        /// <summary>
        /// Mutable last-known Level 1 quote snapshot for a single contract.
        /// Updated on Bid/Ask events and attached to trade prints. Only ever
        /// mutated from NinjaTrader's per-instrument callback thread.
        /// </summary>
        private sealed class QuoteSnapshot
        {
            public double? Bid;
            public double? Ask;
            public long BidSize;
            public long AskSize;
        }
    }
}
#endif
