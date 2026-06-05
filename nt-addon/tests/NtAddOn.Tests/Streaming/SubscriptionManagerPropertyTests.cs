using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck.Xunit;
using NtAddOn.Core.Streaming;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Property-based invariant checks for <see cref="SubscriptionManager"/>
    /// (task 4.10, Req 1.5, 1.7, 1.8). These verify universal properties of the
    /// active-subscription set under arbitrary command sequences.
    ///
    /// <para>These are implementation-support property tests (design Testing
    /// Strategy), NOT one of the numbered correctness Properties 1-31. The
    /// numbered control-plane property "Property 7: Control_Commands equal the
    /// change in the needed-contract set" is the Backend's responsibility and is
    /// implemented by task 9.4. They run at >= 100 iterations per the design.</para>
    ///
    /// <para>Generation strategy: FsCheck natively generates the <c>int[]</c>
    /// parameter; each element is mapped deterministically onto a
    /// (action, contract) command over a small contract universe so generated
    /// sequences exercise repeats, duplicate subscribes, and removals without a
    /// custom Arbitrary.</para>
    /// </summary>
    public class SubscriptionManagerPropertyTests
    {
        private const int Iterations = 200;

        private static readonly string[] Universe =
        {
            "GC 08-26", "GC 10-26", "GC 12-26", "GC 02-27",
        };

        private static string ContractFor(int seed) =>
            Universe[(int)((((long)seed % Universe.Length) + Universe.Length) % Universe.Length)];

        private static ControlAction ActionFor(int seed) =>
            (seed & 1) == 0 ? ControlAction.Subscribe : ControlAction.Unsubscribe;

        /// <summary>
        /// After applying any sequence of Control_Commands, the manager's active
        /// set always equals the underlying subscriber's live-feed set: the
        /// platform-agnostic bookkeeping never diverges from the real
        /// subscribe/unsubscribe calls (Req 1.7, 1.8).
        /// </summary>
        [Property(MaxTest = Iterations)]
        public bool ActiveSet_AlwaysMatchesSubscriberLiveFeeds(int[]? seeds)
        {
            seeds ??= Array.Empty<int>();
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            foreach (var seed in seeds)
            {
                manager.OnControlCommand(new ControlCommand(ActionFor(seed), ContractFor(seed)));
            }

            var active = new HashSet<string>(manager.ActiveContracts);
            var live = new HashSet<string>(subscriber.Live);
            return active.SetEquals(live);
        }

        /// <summary>
        /// The manager is idempotent: it reports a change (and issues a real
        /// subscribe/unsubscribe) only when a contract actually transitions into
        /// or out of the active set, so live feeds are never double-started or
        /// double-stopped (Req 1.7, 1.8).
        /// </summary>
        [Property(MaxTest = Iterations)]
        public bool Transitions_AreDeduplicated(int[]? seeds)
        {
            seeds ??= Array.Empty<int>();
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            foreach (var seed in seeds)
            {
                var command = new ControlCommand(ActionFor(seed), ContractFor(seed));
                var before = manager.IsSubscribed(command.Contract);
                var changed = manager.OnControlCommand(command);

                var expectsChange = command.Action == ControlAction.Subscribe ? !before : before;
                if (changed != expectsChange)
                {
                    return false;
                }
            }

            // Final consistency: each currently-active contract is live.
            return manager.ActiveContracts.All(c => subscriber.Live.Contains(c));
        }

        /// <summary>
        /// Start-up subscription (Req 1.5) is order-preserving and complete: after
        /// SubscribeToAll, the active set equals the distinct candidate list in
        /// first-occurrence order, regardless of duplicates in the input.
        /// </summary>
        [Property(MaxTest = Iterations)]
        public bool SubscribeToAll_CoversEveryDistinctCandidate(int[]? seeds)
        {
            seeds ??= Array.Empty<int>();
            var candidates = seeds.Select(ContractFor).ToArray();

            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            manager.SubscribeToAll(candidates);

            var expected = candidates.Distinct().ToArray();
            return manager.ActiveContracts.SequenceEqual(expected) &&
                   new HashSet<string>(subscriber.Live).SetEquals(expected);
        }
    }
}
