using System;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Example/edge-case unit tests for <see cref="ControlCommand"/> parsing
    /// (task 4.10, Req 1.7, 1.8). Covers the documented control-message wire
    /// shape and the rejection of non-control / malformed frames.
    /// </summary>
    public class ControlCommandTests
    {
        [Fact]
        public void Parse_SubscribeMessage_FromDesignSchema()
        {
            var json = "{\"type\":\"control\",\"action\":\"subscribe\",\"contract\":\"GC 10-26\",\"time\":1730313600300}";

            var cmd = ControlCommand.Parse(json);

            Assert.Equal(ControlAction.Subscribe, cmd.Action);
            Assert.Equal("GC 10-26", cmd.Contract);
            Assert.Equal(1730313600300L, cmd.TimeMs);
        }

        [Fact]
        public void Parse_UnsubscribeMessage()
        {
            var json = "{\"type\":\"control\",\"action\":\"unsubscribe\",\"contract\":\"GC 08-26\"}";

            var cmd = ControlCommand.Parse(json);

            Assert.Equal(ControlAction.Unsubscribe, cmd.Action);
            Assert.Equal("GC 08-26", cmd.Contract);
            Assert.Null(cmd.TimeMs);
        }

        [Fact]
        public void Parse_IgnoresFieldOrderAndExtraFields()
        {
            var json = "{\"action\":\"subscribe\",\"extra\":42,\"contract\":\"GC 12-26\",\"type\":\"control\"}";

            var cmd = ControlCommand.Parse(json);

            Assert.Equal(ControlAction.Subscribe, cmd.Action);
            Assert.Equal("GC 12-26", cmd.Contract);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("not json")]
        [InlineData("[1,2,3]")]
        [InlineData("{\"type\":\"status\",\"state\":\"connected\"}")]
        [InlineData("{\"type\":\"control\",\"action\":\"resume\",\"contract\":\"GC 08-26\"}")]
        [InlineData("{\"type\":\"control\",\"action\":\"subscribe\"}")]
        [InlineData("{\"type\":\"control\",\"action\":\"subscribe\",\"contract\":\"\"}")]
        public void TryParse_RejectsNonControlAndMalformed(string json)
        {
            Assert.False(ControlCommand.TryParse(json, out var cmd));
            Assert.Null(cmd);
        }

        [Fact]
        public void Parse_Throws_OnMalformed()
        {
            Assert.Throws<FormatException>(() => ControlCommand.Parse("{\"type\":\"heartbeat\"}"));
        }

        [Fact]
        public void Constructor_TrimsContract_AndRejectsBlank()
        {
            var cmd = new ControlCommand(ControlAction.Subscribe, "  GC 08-26  ");
            Assert.Equal("GC 08-26", cmd.Contract);

            Assert.Throws<ArgumentException>(() => new ControlCommand(ControlAction.Subscribe, "   "));
        }
    }
}
