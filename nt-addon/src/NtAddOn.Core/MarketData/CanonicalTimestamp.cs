using System;

namespace NtAddOn.Core.MarketData
{
    /// <summary>
    /// Helpers for the Canonical_Timestamp: the integer number of milliseconds
    /// since the Unix epoch (1970-01-01T00:00:00Z) in UTC (Glossary:
    /// Canonical_Timestamp). This is the single, lossless, comparable time key
    /// used across normalization and the Backend for ordering, merging, and
    /// reference-indicator parity.
    ///
    /// Conversions always operate in UTC. A non-UTC <see cref="DateTime"/> is
    /// converted to UTC first so the result is unambiguous regardless of the
    /// machine's local timezone.
    /// </summary>
    public static class CanonicalTimestamp
    {
        private static readonly DateTime UnixEpochUtc =
            new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>
        /// Converts a <see cref="DateTime"/> to Canonical_Timestamp
        /// (ms since Unix epoch UTC). <see cref="DateTimeKind.Unspecified"/>
        /// is assumed to be UTC (NinjaTrader market-data times are delivered as
        /// timestamps that the adapter normalizes to UTC before calling here);
        /// <see cref="DateTimeKind.Local"/> is converted to UTC.
        /// </summary>
        public static long FromDateTime(DateTime value)
        {
            DateTime utc;
            switch (value.Kind)
            {
                case DateTimeKind.Utc:
                    utc = value;
                    break;
                case DateTimeKind.Local:
                    utc = value.ToUniversalTime();
                    break;
                default:
                    // Unspecified: treat as UTC (caller is responsible for
                    // supplying a UTC instant).
                    utc = DateTime.SpecifyKind(value, DateTimeKind.Utc);
                    break;
            }

            return (long)Math.Floor((utc - UnixEpochUtc).TotalMilliseconds);
        }

        /// <summary>
        /// Converts a <see cref="DateTimeOffset"/> to Canonical_Timestamp
        /// (ms since Unix epoch UTC).
        /// </summary>
        public static long FromDateTimeOffset(DateTimeOffset value) =>
            value.ToUnixTimeMilliseconds();

        /// <summary>
        /// Converts a Canonical_Timestamp back to a UTC <see cref="DateTime"/>.
        /// Provided for symmetry and test assertions.
        /// </summary>
        public static DateTime ToDateTimeUtc(long canonicalMs) =>
            UnixEpochUtc.AddMilliseconds(canonicalMs);
    }
}
