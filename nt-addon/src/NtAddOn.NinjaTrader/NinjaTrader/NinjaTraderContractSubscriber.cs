#if NT8
// This file is compiled ONLY when the NinjaTrader 8 assemblies are available
// (see NtAddOn.NinjaTrader.csproj). It is the NinjaTrader-coupled half of the
// task 4.10 control plane: it turns the platform-agnostic "subscribe contract"
// / "unsubscribe contract" decisions made by NtAddOn.Core.SubscriptionManager
// into real NinjaTrader Level 1 market-data subscriptions.
//
// All the decision logic (which contracts are active, applying Control_Commands,
// computing the start-up set) lives in NtAddOn.Core and is unit/property-tested
// without NinjaTrader. This class is the thin, untestable-in-CI adapter that the
// SubscriptionManager calls through the IContractSubscriber seam.

using System;
using System.Collections.Generic;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NtAddOn.Core.Streaming;

namespace NtAddOn.NinjaTrader
{
    /// <summary>
    /// NinjaTrader 8 implementation of <see cref="IContractSubscriber"/>. Starts
    /// and stops the Level 1 market-data subscription for a GC contract and
    /// routes every <see cref="MarketDataEventArgs"/> to the
    /// <see cref="MarketDataCallbackAdapter"/>, tagging the event with its
    /// originating contract (Req 1.5, 1.6, 1.7, 1.8).
    ///
    /// <para>One <see cref="Instrument"/> subscription is held per contract. The
    /// NinjaTrader <c>MarketData.Update</c> event delivers both trade prints
    /// (<see cref="MarketDataType.Last"/>) and quote updates
    /// (<see cref="MarketDataType.Bid"/>/<see cref="MarketDataType.Ask"/>) on the
    /// same channel, so subscribing once covers both the trade and quote feeds a
    /// Stream requires.</para>
    ///
    /// <para><b>Threading.</b> The <see cref="SubscriptionManager"/> serializes
    /// calls to <see cref="Subscribe"/>/<see cref="Unsubscribe"/> under its own
    /// lock and never double-subscribes, but this class also guards its
    /// per-contract handler map so a stray duplicate call cannot leak an event
    /// handler. The market-data callbacks themselves run on NinjaTrader threads
    /// and only normalize + enqueue (Req 2.1-2.3) via the adapter.</para>
    /// </summary>
    public sealed class NinjaTraderContractSubscriber : IContractSubscriber, IDisposable
    {
        private readonly MarketDataCallbackAdapter _adapter;
        private readonly object _gate = new object();

        // Per-contract subscription state so we can detach the exact handler we
        // attached and release the instrument on unsubscribe.
        private readonly Dictionary<string, Subscription> _subscriptions =
            new Dictionary<string, Subscription>(StringComparer.Ordinal);

        /// <summary>
        /// Creates a subscriber that forwards normalized events through
        /// <paramref name="adapter"/>.
        /// </summary>
        public NinjaTraderContractSubscriber(MarketDataCallbackAdapter adapter)
        {
            _adapter = adapter ?? throw new ArgumentNullException(nameof(adapter));
        }

        /// <inheritdoc />
        public void Subscribe(string contract)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException("Contract must be non-empty.", nameof(contract));
            }

            var key = contract.Trim();
            lock (_gate)
            {
                if (_subscriptions.ContainsKey(key))
                {
                    return;
                }

                var instrument = Instrument.GetInstrument(key);
                if (instrument == null)
                {
                    throw new InvalidOperationException(
                        $"NinjaTrader could not resolve instrument '{key}'.");
                }

                // Capture the contract in the closure so each event is tagged
                // with its originating Candidate_Contract (Req 1.6).
                EventHandler<MarketDataEventArgs> handler =
                    (sender, e) => _adapter.OnMarketData(key, e);

                if (instrument.Dispatcher.HasShutdownStarted)
                {
                    throw new InvalidOperationException(
                        $"NinjaTrader market-data dispatcher is shutting down for '{key}'.");
                }

                instrument.Dispatcher.InvokeAsync(
                    () => instrument.MarketData.Update += handler);

                _subscriptions[key] = new Subscription(instrument, handler);
            }
        }

        /// <inheritdoc />
        public void Unsubscribe(string contract)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException("Contract must be non-empty.", nameof(contract));
            }

            var key = contract.Trim();
            lock (_gate)
            {
                if (!_subscriptions.TryGetValue(key, out var subscription))
                {
                    return;
                }

                Detach(subscription);
                _subscriptions.Remove(key);
            }
        }

        /// <summary>
        /// Detaches every active subscription. Called when the AddOn shuts down.
        /// </summary>
        public void Dispose()
        {
            lock (_gate)
            {
                foreach (var subscription in _subscriptions.Values)
                {
                    Detach(subscription);
                }

                _subscriptions.Clear();
            }
        }

        private static void Detach(Subscription subscription)
        {
            if (!subscription.Instrument.Dispatcher.HasShutdownStarted)
            {
                subscription.Instrument.Dispatcher.InvokeAsync(
                    () => subscription.Instrument.MarketData.Update -= subscription.Handler);
            }
        }

        private sealed class Subscription
        {
            public Subscription(Instrument instrument, EventHandler<MarketDataEventArgs> handler)
            {
                Instrument = instrument;
                Handler = handler;
            }

            public Instrument Instrument { get; }

            public EventHandler<MarketDataEventArgs> Handler { get; }
        }
    }
}
#endif
