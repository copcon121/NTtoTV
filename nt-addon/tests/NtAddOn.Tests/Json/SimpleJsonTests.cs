using System.Collections.Generic;
using NtAddOn.Core.Json;
using Xunit;

namespace NtAddOn.Tests.Json
{
    /// <summary>
    /// Example/edge-case unit tests for <see cref="SimpleJson"/>, the
    /// dependency-free JSON reader used to parse inbound <c>/ws/nt</c> control
    /// messages (task 4.10). Covers objects, arrays, strings with escapes,
    /// numbers, booleans, null, whitespace, and malformed input.
    /// </summary>
    public class SimpleJsonTests
    {
        [Fact]
        public void Parse_FlatObject_WithMixedValueTypes()
        {
            var root = SimpleJson.Parse(
                "{\"type\":\"control\",\"action\":\"subscribe\",\"contract\":\"GC 10-26\",\"time\":1730313600300}");

            var obj = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(root);
            Assert.Equal("control", obj["type"]);
            Assert.Equal("subscribe", obj["action"]);
            Assert.Equal("GC 10-26", obj["contract"]);
            Assert.Equal(1730313600300d, Assert.IsType<double>(obj["time"]));
        }

        [Fact]
        public void Parse_HandlesWhitespaceAndNesting()
        {
            var root = SimpleJson.Parse("  { \"a\" : [ 1 , 2 , { \"b\" : true } ] , \"c\" : null } ");

            var obj = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(root);
            var arr = Assert.IsAssignableFrom<IReadOnlyList<object?>>(obj["a"]);
            Assert.Equal(3, arr.Count);
            Assert.Equal(1d, arr[0]);
            var nested = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(arr[2]);
            Assert.Equal(true, nested["b"]);
            Assert.Null(obj["c"]);
        }

        [Fact]
        public void Parse_DecodesStringEscapes()
        {
            var root = SimpleJson.Parse("{\"s\":\"a\\tb\\n\\u0041\"}");
            var obj = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(root);
            Assert.Equal("a\tb\nA", obj["s"]);
        }

        [Fact]
        public void Parse_NegativeAndDecimalNumbers()
        {
            var root = SimpleJson.Parse("{\"n\":-12.5,\"e\":2e3}");
            var obj = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(root);
            Assert.Equal(-12.5d, obj["n"]);
            Assert.Equal(2000d, obj["e"]);
        }

        [Theory]
        [InlineData("")]
        [InlineData("{")]
        [InlineData("{\"a\":}")]
        [InlineData("{\"a\":1,}")]
        [InlineData("[1,2")]
        [InlineData("{\"a\":1} trailing")]
        [InlineData("nul")]
        public void TryParse_ReturnsFalse_OnMalformed(string text)
        {
            Assert.False(SimpleJson.TryParse(text, out _));
        }

        [Fact]
        public void TryParse_ReturnsTrue_OnValid()
        {
            Assert.True(SimpleJson.TryParse("{\"ok\":true}", out var value));
            var obj = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(value);
            Assert.Equal(true, obj["ok"]);
        }
    }
}
