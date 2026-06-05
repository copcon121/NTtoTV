using System;
using System.Linq;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Example/edge-case unit tests for <see cref="SubscriptionManager"/>
    /// (task 4.10, Req 1.5, 1.7, 1.8). Covers start-up subscription to all
    /// candidates, subscribe/unsubscribe Control_Commands, and idempotency.
    /// </summary>
    public class SubscriptionManagerTests
    {
        [Fact]
        public void SubscribeToAll_SubscribesEveryCandidate_Once_InOrder()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            var added = manager.SubscribeToAll(new[] { "GC 08-26", "GC 10-26", "GC 12-26" });

            Assert.Equal(new[] { "GC 08-26", "GC 10-26", "GC 12-26" }, added);
            Assert.Equal(new[] { "GC 08-26", "GC 10-26", "GC 12-26" }, manager.ActiveContracts);
            Assert.Equal(
                new[]
                {
                    ("subscribe", "GC 08-26"),
                    ("subscribe", "GC 10-26"),
                    ("subscribe", "GC 12-26"),
                },
                subscriber.Calls);
        }

        [Fact]
        public void SubscribeToAll_IsIdempotent_ForAlreadyActiveContracts()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            manager.SubscribeToAll(new[] { "GC 08-26", "GC 10-26" });
            var addedAgain = manager.SubscribeToAll(new[] { "GC 08-26", "GC 10-26", "GC 12-26" });

            // Only the genuinely new contract is subscribed the second time.
            Assert.Equal(new[] { "GC 12-26" }, addedAgain);
            Assert.Equal(3, subscriber.SubscribeCount);
        }

        [Fact]
        public void SubscribeToAll_SkipsBlankEntries()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            var added = manager.SubscribeToAll(new[] { "GC 08-26", "", "  ", "GC 10-26" });

            Assert.Equal(new[] { "GC 08-26", "GC 10-26" }, added);
        }

        [Fact]
        public void OnControlCommand_Subscribe_AddsContract()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            var changed = manager.OnControlCommand(new ControlCommand(ControlAction.Subscribe, "GC 10-26"));

            Assert.True(changed);
            Assert.True(manager.IsSubscribed("GC 10-26"));
            Assert.Contains("GC 10-26", subscriber.Live);
        }

        [Fact]
        public void OnControlCommand_Unsubscribe_RemovesContract()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);
            manager.SubscribeToAll(new[] { "GC 08-26", "GC 10-26" });

            var changed = manager.OnControlCommand(new ControlCommand(ControlAction.Unsubscribe, "GC 08-26"));

            Assert.True(changed);
            Assert.False(manager.IsSubscribed("GC 08-26"));
            Assert.DoesNotContain("GC 08-26", subscriber.Live);
            Assert.Equal(new[] { "GC 10-26" }, manager.ActiveContracts);
        }

        [Fact]
        public void Subscribe_Duplicate_IsNoOp()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            Assert.True(manager.Subscribe("GC 08-26"));
            Assert.False(manager.Subscribe("GC 08-26"));
            Assert.Equal(1, subscriber.SubscribeCount);
        }

        [Fact]
        public void Unsubscribe_NotActive_IsNoOp()
        {
            var subscriber = new RecordingContractSubscriber();
            var manager = new SubscriptionManager(subscriber);

            Assert.False(manager.Unsubscribe("GC 08-26"));
            Assert.Equal(0, subscriber.UnsubscribeCount);
        }

        [Fact]
        public void Subscribe_Failure_RollsBackActiveSet()
        {
            var subscriber = new RecordingContractSubscriber
            {
                FailSubscribeFor = c => c == "GC 10-26",
            };
            var manager = new SubscriptionManager(subscriber);

            Assert.Throws<InvalidOperationException>(() => manager.Subscribe("GC 10-26"));

            // The failed subscribe must not leave the contract in the active set.
            Assert.False(manager.IsSubscribed("GC 10-26"));
            Assert.Empty(manager.ActiveContracts);
        }

        [Fact]
        public void OnControlCommand_NullCommand_Throws()
        {
            var manager = new SubscriptionManager(new RecordingContractSubscriber());
            Assert.Throws<ArgumentNullException>(() => manager.OnControlCommand(null!));
        }
    }
}
