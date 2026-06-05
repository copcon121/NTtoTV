using System.Collections.Generic;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Example/edge-case unit tests for <see cref="ConnectionStatusEmitter"/> and
    /// <see cref="StatusEvent"/> serialization (task 4.10, Req 3.4, 20.1). Covers
    /// edge-triggered emission, de-duplication, the timestamped payload, and the
    /// documented status wire shape.
    /// </summary>
    public class ConnectionStatusEmitterTests
    {
        [Fact]
        public void Report_RaisesStatusChanged_OnEachDistinctTransition()
        {
            var emitter = new ConnectionStatusEmitter(() => 1000L);
            var observed = new List<ConnectionStatus>();
            emitter.StatusChanged += s => observed.Add(s);

            emitter.ReportConnected();
            emitter.ReportDegraded();
            emitter.ReportDisconnected();

            Assert.Equal(
                new[] { ConnectionStatus.Connected, ConnectionStatus.Degraded, ConnectionStatus.Disconnected },
                observed);
        }

        [Fact]
        public void Report_SuppressesDuplicateState()
        {
            var emitter = new ConnectionStatusEmitter(() => 1000L);
            var count = 0;
            emitter.StatusChanged += _ => count++;

            Assert.True(emitter.ReportConnected());
            Assert.False(emitter.ReportConnected());
            Assert.False(emitter.ReportConnected());

            Assert.Equal(1, count);
            Assert.Equal(ConnectionStatus.Connected, emitter.Current);
        }

        [Fact]
        public void Report_RaisesAgain_WhenStateReturns()
        {
            var emitter = new ConnectionStatusEmitter(() => 1000L);
            var count = 0;
            emitter.StatusChanged += _ => count++;

            emitter.ReportConnected();
            emitter.ReportDisconnected();
            emitter.ReportConnected();

            Assert.Equal(3, count);
        }

        [Fact]
        public void StatusChangedEvent_CarriesTimestampedPayload()
        {
            var emitter = new ConnectionStatusEmitter(() => 1730313600200L);
            StatusEvent? captured = null;
            emitter.StatusChangedEvent += e => captured = e;

            emitter.ReportConnected();

            Assert.NotNull(captured);
            Assert.Equal(ConnectionStatus.Connected, captured!.State);
            Assert.Equal(1730313600200L, captured.TimeMs);
            Assert.Equal(StatusEvent.NtAddOnSource, captured.Source);
        }

        [Fact]
        public void StatusEvent_ToJson_MatchesDesignWireShape()
        {
            var evt = new StatusEvent(ConnectionStatus.Connected, 1730313600200L);

            Assert.Equal(
                "{\"type\":\"status\",\"source\":\"nt_addon\",\"state\":\"connected\",\"time\":1730313600200}",
                evt.ToJson());
        }

        [Fact]
        public void StatusEvent_ToJson_IncludesContractWhenPresent()
        {
            var evt = new StatusEvent(ConnectionStatus.Degraded, 1730313600200L, contract: "GC 08-26");

            Assert.Equal(
                "{\"type\":\"status\",\"source\":\"nt_addon\",\"state\":\"degraded\",\"contract\":\"GC 08-26\",\"time\":1730313600200}",
                evt.ToJson());
        }

        [Theory]
        [InlineData(ConnectionStatus.Connected, "connected")]
        [InlineData(ConnectionStatus.Degraded, "degraded")]
        [InlineData(ConnectionStatus.Disconnected, "disconnected")]
        public void StatusEvent_ToWireState_MapsAllStates(ConnectionStatus state, string expected)
        {
            Assert.Equal(expected, StatusEvent.ToWireState(state));
        }
    }
}
