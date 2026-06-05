using System;
using NtAddOn.Core.Configuration;
using Xunit;

namespace NtAddOn.Tests.Configuration
{
    /// <summary>
    /// Example/edge-case unit tests for the AddOn configuration model
    /// (design Testing Strategy: config defaults + validation). These cover
    /// the configuration fields required by task 1.3: candidate contract list,
    /// Backend host/port, queue capacity, critical-overload threshold,
    /// compression flag, and optional manual contract override.
    /// </summary>
    public class AddOnConfigTests
    {
        private static AddOnConfig MinimalConfig() =>
            new AddOnConfig(new[] { "GC 08-26", "GC 10-26", "GC 12-26" });

        [Fact]
        public void Defaults_AreAppliedWhenOnlyCandidatesProvided()
        {
            var config = MinimalConfig();

            Assert.Equal(AddOnConfig.DefaultBackendHost, config.BackendHost);
            Assert.Equal(AddOnConfig.DefaultBackendPort, config.BackendPort);
            Assert.Equal(AddOnConfig.DefaultQueueCapacity, config.QueueCapacity);
            Assert.Equal(AddOnConfig.DefaultCriticalOverloadThreshold, config.CriticalOverloadThreshold);
            Assert.False(config.CompressionEnabled);
            Assert.Null(config.ManualContractOverride);
            Assert.False(config.HasManualOverride);
        }

        [Fact]
        public void CandidateContracts_ArePreservedInOrder()
        {
            var config = MinimalConfig();

            Assert.Equal(new[] { "GC 08-26", "GC 10-26", "GC 12-26" }, config.CandidateContracts);
        }

        [Fact]
        public void BuildBackendUri_UsesHostPortAndPath()
        {
            var config = new AddOnConfig(
                new[] { "GC 08-26" },
                backendHost: "127.0.0.1",
                backendPort: 9001,
                backendPath: "/ws/nt");

            Assert.Equal("ws://127.0.0.1:9001/ws/nt", config.BuildBackendUri().ToString());
        }

        [Fact]
        public void ManualOverride_IsHonoredWhenAmongCandidates()
        {
            var config = new AddOnConfig(
                new[] { "GC 08-26", "GC 10-26" },
                manualContractOverride: "GC 10-26");

            Assert.True(config.HasManualOverride);
            Assert.Equal("GC 10-26", config.ManualContractOverride);
        }

        [Fact]
        public void EmptyCandidateList_Throws()
        {
            Assert.Throws<ArgumentException>(() => new AddOnConfig(Array.Empty<string>()));
        }

        [Fact]
        public void DuplicateCandidates_Throw()
        {
            Assert.Throws<ArgumentException>(
                () => new AddOnConfig(new[] { "GC 08-26", "GC 08-26" }));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(70000)]
        public void InvalidPort_Throws(int port)
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => new AddOnConfig(new[] { "GC 08-26" }, backendPort: port));
        }

        [Fact]
        public void CriticalThresholdAboveCapacity_Throws()
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => new AddOnConfig(
                    new[] { "GC 08-26" },
                    queueCapacity: 100,
                    criticalOverloadThreshold: 101));
        }

        [Fact]
        public void ManualOverrideNotAmongCandidates_Throws()
        {
            Assert.Throws<ArgumentException>(
                () => new AddOnConfig(
                    new[] { "GC 08-26" },
                    manualContractOverride: "GC 12-26"));
        }
    }
}
