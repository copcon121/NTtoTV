using System;
using System.Collections.Generic;
using System.Linq;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Platform-agnostic manager of the NT_AddOn's <em>active subscription set</em>
    /// — the set of GC contracts whose Level 1 trade and quote feeds are
    /// currently subscribed (Req 1.5, 1.7, 1.8).
    ///
    /// <para>This type owns all the decision logic and is fully unit/property
    /// testable without NinjaTrader: it tracks which contracts are active,
    /// applies inbound Control_Commands, and computes the start-up subscription
    /// set. The actual NinjaTrader subscribe/unsubscribe calls are delegated to
    /// an injected <see cref="IContractSubscriber"/> whose concrete
    /// implementation lives in <c>NtAddOn.NinjaTrader</c> under <c>#if NT8</c>.</para>
    ///
    /// <para><b>Idempotency.</b> The manager is the source of truth for the
    /// active set, so it never asks the subscriber to subscribe a contract that
    /// is already active or to unsubscribe one that is not. Each mutating call
    /// reports whether it changed the set, and the underlying
    /// <see cref="IContractSubscriber"/> is invoked at most once per actual
    /// transition.</para>
    ///
    /// <para><b>Thread safety.</b> Control_Commands arrive on the background
    /// worker's receive loop while start-up subscription happens on the AddOn
    /// start path, so all state mutations are guarded by a single lock. The
    /// <see cref="IContractSubscriber"/> call for a transition is made while the
    /// lock is held so the active set and the underlying NinjaTrader
    /// subscriptions never diverge under concurrent commands. Contract
    /// identifiers are compared ordinally and insertion order is preserved for
    /// deterministic enumeration.</para>
    /// </summary>
    public sealed class SubscriptionManager
    {
        private readonly IContractSubscriber _subscriber;
        private readonly object _gate = new object();

        // Insertion-ordered membership: the list preserves order for
        // deterministic enumeration; the set gives O(1) membership tests. Both
        // are kept consistent under the lock.
        private readonly List<string> _activeOrder = new List<string>();
        private readonly HashSet<string> _activeSet = new HashSet<string>(StringComparer.Ordinal);

        /// <summary>
        /// Creates a manager that delegates real subscribe/unsubscribe calls to
        /// <paramref name="subscriber"/>.
        /// </summary>
        public SubscriptionManager(IContractSubscriber subscriber)
        {
            _subscriber = subscriber ?? throw new ArgumentNullException(nameof(subscriber));
        }

        /// <summary>
        /// A snapshot of the currently active contracts, in the order they were
        /// first subscribed.
        /// </summary>
        public IReadOnlyList<string> ActiveContracts
        {
            get
            {
                lock (_gate)
                {
                    return _activeOrder.ToArray();
                }
            }
        }

        /// <summary>The number of currently active contracts.</summary>
        public int Count
        {
            get
            {
                lock (_gate)
                {
                    return _activeOrder.Count;
                }
            }
        }

        /// <summary>
        /// Returns <see langword="true"/> when <paramref name="contract"/> is in
        /// the active subscription set.
        /// </summary>
        public bool IsSubscribed(string contract)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                return false;
            }

            var key = contract.Trim();
            lock (_gate)
            {
                return _activeSet.Contains(key);
            }
        }

        /// <summary>
        /// Start-up subscription (Req 1.5): subscribes to the Level 1 trade and
        /// quote feeds of every configured Candidate_Contract. Contracts already
        /// active are left untouched (idempotent); blank entries are ignored.
        /// Returns the contracts that were newly subscribed by this call, in the
        /// order they were applied.
        /// </summary>
        /// <param name="contracts">The configured Candidate_Contracts.</param>
        public IReadOnlyList<string> SubscribeToAll(IEnumerable<string> contracts)
        {
            if (contracts == null)
            {
                throw new ArgumentNullException(nameof(contracts));
            }

            var added = new List<string>();
            lock (_gate)
            {
                foreach (var raw in contracts)
                {
                    if (string.IsNullOrWhiteSpace(raw))
                    {
                        continue;
                    }

                    if (ApplySubscribe(raw.Trim()))
                    {
                        added.Add(raw.Trim());
                    }
                }
            }

            return added;
        }

        /// <summary>
        /// Applies an inbound Control_Command (Req 1.7, 1.8): a
        /// <see cref="ControlAction.Subscribe"/> command begins subscribing the
        /// command's contract; an <see cref="ControlAction.Unsubscribe"/> command
        /// stops. Returns <see langword="true"/> when the active set changed.
        /// </summary>
        public bool OnControlCommand(ControlCommand command)
        {
            if (command == null)
            {
                throw new ArgumentNullException(nameof(command));
            }

            switch (command.Action)
            {
                case ControlAction.Subscribe:
                    return Subscribe(command.Contract);
                case ControlAction.Unsubscribe:
                    return Unsubscribe(command.Contract);
                default:
                    throw new ArgumentOutOfRangeException(
                        nameof(command), command.Action, "Unknown control action.");
            }
        }

        /// <summary>
        /// Begins subscribing the Level 1 trade and quote feeds of
        /// <paramref name="contract"/> (Req 1.7). No-op (returns
        /// <see langword="false"/>) when the contract is already active.
        /// </summary>
        public bool Subscribe(string contract)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException("Contract must be non-empty.", nameof(contract));
            }

            lock (_gate)
            {
                return ApplySubscribe(contract.Trim());
            }
        }

        /// <summary>
        /// Stops subscribing the Level 1 trade and quote feeds of
        /// <paramref name="contract"/> (Req 1.8). No-op (returns
        /// <see langword="false"/>) when the contract is not active.
        /// </summary>
        public bool Unsubscribe(string contract)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException("Contract must be non-empty.", nameof(contract));
            }

            lock (_gate)
            {
                return ApplyUnsubscribe(contract.Trim());
            }
        }

        // Assumes _gate is held. Invokes the subscriber only on an actual
        // transition so the active set and NinjaTrader subscriptions stay in sync.
        private bool ApplySubscribe(string contract)
        {
            if (_activeSet.Contains(contract))
            {
                return false;
            }

            // Mutate state before the external call so a throwing subscriber
            // cannot leave the set claiming "not subscribed" while a feed exists;
            // and roll back if the subscribe call fails.
            _activeSet.Add(contract);
            _activeOrder.Add(contract);
            try
            {
                _subscriber.Subscribe(contract);
            }
            catch
            {
                _activeSet.Remove(contract);
                _activeOrder.Remove(contract);
                throw;
            }

            return true;
        }

        // Assumes _gate is held.
        private bool ApplyUnsubscribe(string contract)
        {
            if (!_activeSet.Contains(contract))
            {
                return false;
            }

            _activeSet.Remove(contract);
            _activeOrder.Remove(contract);
            try
            {
                _subscriber.Unsubscribe(contract);
            }
            catch
            {
                _activeSet.Add(contract);
                _activeOrder.Add(contract);
                throw;
            }

            return true;
        }
    }
}
