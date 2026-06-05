using System;
using NtAddOn.Core.MarketData;
using Xunit;

namespace NtAddOn.Tests.MarketData
{
    /// <summary>
    /// Example/edge-case unit tests for the Canonical_Timestamp helper used by
    /// normalization (Glossary: Canonical_Timestamp = ms since Unix epoch UTC).
    /// </summary>
    public class CanonicalTimestampTests
    {
        [Fact]
        public void Epoch_IsZero()
        {
            var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            Assert.Equal(0, CanonicalTimestamp.FromDateTime(epoch));
        }

        [Fact]
        public void KnownInstant_ConvertsToExpectedMillis()
        {
            var instant = new DateTime(2024, 10, 30, 18, 40, 0, 123, DateTimeKind.Utc);
            var ms = CanonicalTimestamp.FromDateTime(instant);

            Assert.Equal(instant, CanonicalTimestamp.ToDateTimeUtc(ms));
            // Round-trips losslessly at millisecond precision.
            Assert.Equal(123, ms % 1000);
        }

        [Fact]
        public void UnspecifiedKind_IsTreatedAsUtc()
        {
            var utc = new DateTime(2024, 1, 2, 3, 4, 5, 678, DateTimeKind.Utc);
            var unspecified = DateTime.SpecifyKind(utc, DateTimeKind.Unspecified);

            Assert.Equal(
                CanonicalTimestamp.FromDateTime(utc),
                CanonicalTimestamp.FromDateTime(unspecified));
        }

        [Fact]
        public void LocalKind_IsConvertedToUtc()
        {
            var utc = new DateTime(2024, 6, 15, 12, 0, 0, DateTimeKind.Utc);
            var local = utc.ToLocalTime();

            Assert.Equal(
                CanonicalTimestamp.FromDateTime(utc),
                CanonicalTimestamp.FromDateTime(local));
        }

        [Fact]
        public void DateTimeOffset_UsesUnixMillis()
        {
            var dto = new DateTimeOffset(2024, 10, 30, 18, 40, 0, 123, TimeSpan.Zero);
            Assert.Equal(dto.ToUnixTimeMilliseconds(), CanonicalTimestamp.FromDateTimeOffset(dto));
        }
    }
}
