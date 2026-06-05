namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Seam that isolates the NinjaTrader-specific Level 1 subscribe/unsubscribe
    /// calls from the platform-agnostic subscription-management logic in
    /// <c>NtAddOn.Core</c> (Req 1.5, 1.7, 1.8).
    ///
    /// <para>The <see cref="SubscriptionManager"/> decides <em>which</em>
    /// contracts should be subscribed (the active subscription set) and calls
    /// this interface to actually start or stop a contract's trade and quote
    /// feeds. The concrete implementation lives in <c>NtAddOn.NinjaTrader</c>
    /// under <c>#if NT8</c> and creates/cancels the NinjaTrader market-data
    /// subscription for the contract. Keeping it behind an interface lets the
    /// manager be unit/property-tested with an in-memory fake, without
    /// NinjaTrader present.</para>
    ///
    /// <para>Implementations subscribe to <b>both</b> the Level 1 trade feed and
    /// the Level 1 quote feed of a contract together, because a Stream is the
    /// tuple (symbol, contract, channel) and the platform always needs both
    /// channels for a subscribed contract (Req 1.5, 1.7).</para>
    ///
    /// <para>Calls are expected to be idempotent at the manager level: the
    /// <see cref="SubscriptionManager"/> only invokes <see cref="Subscribe"/> for
    /// a contract that is not already in the active set, and
    /// <see cref="Unsubscribe"/> only for one that is, so implementations do not
    /// need to guard against duplicate subscribe/unsubscribe of the same
    /// contract.</para>
    /// </summary>
    public interface IContractSubscriber
    {
        /// <summary>
        /// Begins subscribing to the Level 1 trade and quote feeds of
        /// <paramref name="contract"/> (Req 1.5, 1.7).
        /// </summary>
        /// <param name="contract">
        /// The GC contract identifier to subscribe, e.g. "GC 08-26".
        /// </param>
        void Subscribe(string contract);

        /// <summary>
        /// Stops subscribing to the Level 1 trade and quote feeds of
        /// <paramref name="contract"/> (Req 1.8).
        /// </summary>
        /// <param name="contract">
        /// The GC contract identifier to unsubscribe, e.g. "GC 08-26".
        /// </param>
        void Unsubscribe(string contract);
    }
}
