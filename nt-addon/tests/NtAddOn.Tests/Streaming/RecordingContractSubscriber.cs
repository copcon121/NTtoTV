using System;
using System.Collections.Generic;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// In-memory test double for <see cref="IContractSubscriber"/> used by the
    /// task 4.10 control-plane tests. It records every subscribe/unsubscribe call
    /// in order and tracks the resulting "live feed" set so tests can assert both
    /// the call sequence and the net subscription state, without NinjaTrader.
    /// </summary>
    internal sealed class RecordingContractSubscriber : IContractSubscriber
    {
        private readonly HashSet<string> _live = new HashSet<string>(StringComparer.Ordinal);

        /// <summary>Ordered log of (action, contract) calls.</summary>
        public List<(string Action, string Contract)> Calls { get; } =
            new List<(string Action, string Contract)>();

        /// <summary>The set of contracts whose feeds are currently live.</summary>
        public IReadOnlyCollection<string> Live => _live;

        /// <summary>
        /// Optional fault injector: when set and it returns true for a contract,
        /// <see cref="Subscribe"/> throws to exercise rollback behavior.
        /// </summary>
        public Func<string, bool>? FailSubscribeFor { get; set; }

        public int SubscribeCount { get; private set; }

        public int UnsubscribeCount { get; private set; }

        public void Subscribe(string contract)
        {
            if (FailSubscribeFor != null && FailSubscribeFor(contract))
            {
                throw new InvalidOperationException($"Injected subscribe failure for '{contract}'.");
            }

            Calls.Add(("subscribe", contract));
            SubscribeCount++;
            _live.Add(contract);
        }

        public void Unsubscribe(string contract)
        {
            Calls.Add(("unsubscribe", contract));
            UnsubscribeCount++;
            _live.Remove(contract);
        }
    }
}
