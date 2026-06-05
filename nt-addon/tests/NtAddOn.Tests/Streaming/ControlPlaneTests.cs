using System.Collections.Generic;
using NtAddOn.Core.Configuration;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Example/edge-case unit tests for the <see cref="ControlPlane"/> coordinator
    /// (task 4.10). Exercises the three responsibilities together: start-up
    /// subscription to all Candidate_Contracts (Req 1.5), raw inbound
    /// Control_Command handling (Req 1.7, 1.8), and status emission (Req 3.4,
    /// 20.1).
    /// </summary>
    public class ControlPlaneTests
    {
        private static AddOnConfig Config(params string[] candidates) =>
            new AddOnConfig(candidates);

        [Fact]
        public void Start_SubscribesToAllConfiguredCandidates()
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1000L);

            var added = plane.Start(Config("GC 08-26", "GC 10-26", "GC 12-26"));

            Assert.Equal(new[] { "GC 08-26", "GC 10-26", "GC 12-26" }, added);
            Assert.Equal(new[] { "GC 08-26", "GC 10-26", "GC 12-26" }, plane.ActiveContracts);
        }

        [Fact]
        public void OnControlMessage_Subscribe_ChangesActiveSet()
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1000L);
            plane.Start(Config("GC 08-26"));

            var changed = plane.OnControlMessage(
                "{\"type\":\"control\",\"action\":\"subscribe\",\"contract\":\"GC 10-26\",\"time\":1730313600300}");

            Assert.True(changed);
            Assert.Contains("GC 10-26", plane.ActiveContracts);
        }

        [Fact]
        public void OnControlMessage_Unsubscribe_ChangesActiveSet()
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1000L);
            plane.Start(Config("GC 08-26", "GC 10-26"));

            var changed = plane.OnControlMessage(
                "{\"type\":\"control\",\"action\":\"unsubscribe\",\"contract\":\"GC 08-26\"}");

            Assert.True(changed);
            Assert.DoesNotContain("GC 08-26", plane.ActiveContracts);
        }

        [Theory]
        [InlineData("{\"type\":\"heartbeat\"}")]
        [InlineData("not json")]
        [InlineData("{\"type\":\"control\",\"action\":\"subscribe\"}")]
        public void OnControlMessage_IgnoresNonControlAndMalformedFrames(string frame)
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1000L);
            plane.Start(Config("GC 08-26"));

            var changed = plane.OnControlMessage(frame);

            Assert.False(changed);
            Assert.Equal(new[] { "GC 08-26" }, plane.ActiveContracts);
        }

        [Fact]
        public void OnControlMessage_Subscribe_AlreadyActive_ReportsNoChange()
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1000L);
            plane.Start(Config("GC 08-26"));

            var changed = plane.OnControlMessage(
                "{\"type\":\"control\",\"action\":\"subscribe\",\"contract\":\"GC 08-26\"}");

            Assert.False(changed);
            Assert.Equal(1, subscriber.SubscribeCount);
        }

        [Fact]
        public void ReportStatus_RaisesStatusChangedAndPayload()
        {
            var subscriber = new RecordingContractSubscriber();
            var plane = new ControlPlane(subscriber, () => 1730313600200L);

            var states = new List<ConnectionStatus>();
            StatusEvent? payload = null;
            plane.StatusChanged += s => states.Add(s);
            plane.StatusChangedEvent += e => payload = e;

            plane.ReportStatus(ConnectionStatus.Connected);
            plane.ReportStatus(ConnectionStatus.Degraded);

            Assert.Equal(new[] { ConnectionStatus.Connected, ConnectionStatus.Degraded }, states);
            Assert.Equal(ConnectionStatus.Degraded, plane.ConnectionState);
            Assert.NotNull(payload);
            Assert.Equal(1730313600200L, payload!.TimeMs);
        }
    }
}
