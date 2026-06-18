using System;
using System.Globalization;
using System.Text;
using NtAddOn.Core.MarketData;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Default <see cref="INormalizedEventSerializer"/> that emits the exact
    /// documented <c>/ws/nt</c> data-plane JSON shapes for trades and quotes
    /// (design "WebSocket Message Schemas"; Req 1.1, 1.2).
    ///
    /// <para><b>Why hand-written.</b> <c>NtAddOn.Core</c> targets
    /// netstandard2.0 and takes no third-party dependency, and NinjaTrader 8
    /// runs on .NET Framework 4.8 (which has no built-in
    /// <c>System.Text.Json</c>). A tiny, allocation-conscious writer keeps the
    /// project dependency-free and gives precise, deterministic control over
    /// field order, number formatting (always
    /// <see cref="CultureInfo.InvariantCulture"/>), and null handling so the
    /// output matches the documented shapes byte-for-byte regardless of the host
    /// machine's locale.</para>
    ///
    /// <para>Field order matches the design exactly:</para>
    /// <list type="bullet">
    ///   <item><description><b>trade</b>: type, symbol, contract, time, price,
    ///   volume, bid, ask, bestBid, bestAsk, sequence.</description></item>
    ///   <item><description><b>quote</b>: type, symbol, contract, time, bid, ask,
    ///   bidSize, askSize, sequence.</description></item>
    /// </list>
    ///
    /// <para>Nullable trade snapshot fields (<c>bid</c>, <c>ask</c>,
    /// <c>bestBid</c>, <c>bestAsk</c>) are emitted as JSON <c>null</c> when not
    /// known, which the Backend models accept (<c>float | None</c>).</para>
    /// </summary>
    public sealed class NormalizedEventJsonSerializer : INormalizedEventSerializer
    {
        /// <summary>A shared, stateless instance (the serializer holds no state).</summary>
        public static readonly NormalizedEventJsonSerializer Instance =
            new NormalizedEventJsonSerializer();

        /// <inheritdoc />
        public string Serialize(INormalizedEvent ev)
        {
            if (ev == null)
            {
                throw new ArgumentNullException(nameof(ev));
            }

            switch (ev)
            {
                case NormalizedTrade trade:
                    return SerializeTrade(trade);
                case NormalizedQuote quote:
                    return SerializeQuote(quote);
                default:
                    throw new ArgumentException(
                        $"Unsupported normalized event type '{ev.GetType().FullName}'. " +
                        "Only NormalizedTrade and NormalizedQuote can be serialized to the /ws/nt wire shapes.",
                        nameof(ev));
            }
        }

        // Trade shape (Req 1.1):
        // {"type":"trade","symbol":..,"contract":..,"time":..,"timeTicks":..,
        //  "price":..,"volume":..,"bid":..,"ask":..,"bestBid":..,"bestAsk":..,"sequence":..}
        private static string SerializeTrade(NormalizedTrade t)
        {
            var sb = new StringBuilder(224);
            sb.Append('{');
            AppendString(sb, "type", NormalizedEvent.TradeType);
            sb.Append(',');
            AppendString(sb, "symbol", t.Symbol);
            sb.Append(',');
            AppendString(sb, "contract", t.Contract);
            sb.Append(',');
            AppendLong(sb, "time", t.Time);
            sb.Append(',');
            if (t.TimeTicks.HasValue)
            {
                AppendLong(sb, "timeTicks", t.TimeTicks.Value);
                sb.Append(',');
            }
            AppendDouble(sb, "price", t.Price);
            sb.Append(',');
            AppendLong(sb, "volume", t.Volume);
            sb.Append(',');
            AppendNullableDouble(sb, "bid", t.Bid);
            sb.Append(',');
            AppendNullableDouble(sb, "ask", t.Ask);
            sb.Append(',');
            AppendNullableDouble(sb, "bestBid", t.BestBid);
            sb.Append(',');
            AppendNullableDouble(sb, "bestAsk", t.BestAsk);
            sb.Append(',');
            AppendLong(sb, "sequence", t.Sequence);
            sb.Append('}');
            return sb.ToString();
        }

        // Quote shape (Req 1.2):
        // {"type":"quote","symbol":..,"contract":..,"time":..,"bid":..,"ask":..,
        //  "bidSize":..,"askSize":..,"sequence":..}
        private static string SerializeQuote(NormalizedQuote q)
        {
            var sb = new StringBuilder(160);
            sb.Append('{');
            AppendString(sb, "type", NormalizedEvent.QuoteType);
            sb.Append(',');
            AppendString(sb, "symbol", q.Symbol);
            sb.Append(',');
            AppendString(sb, "contract", q.Contract);
            sb.Append(',');
            AppendLong(sb, "time", q.Time);
            sb.Append(',');
            AppendDouble(sb, "bid", q.Bid);
            sb.Append(',');
            AppendDouble(sb, "ask", q.Ask);
            sb.Append(',');
            AppendLong(sb, "bidSize", q.BidSize);
            sb.Append(',');
            AppendLong(sb, "askSize", q.AskSize);
            sb.Append(',');
            AppendLong(sb, "sequence", q.Sequence);
            sb.Append('}');
            return sb.ToString();
        }

        // --- primitive writers -------------------------------------------

        private static void AppendString(StringBuilder sb, string name, string value)
        {
            AppendKey(sb, name);
            AppendQuoted(sb, value);
        }

        private static void AppendLong(StringBuilder sb, string name, long value)
        {
            AppendKey(sb, name);
            sb.Append(value.ToString(CultureInfo.InvariantCulture));
        }

        private static void AppendDouble(StringBuilder sb, string name, double value)
        {
            AppendKey(sb, name);
            sb.Append(FormatDouble(value));
        }

        private static void AppendNullableDouble(StringBuilder sb, string name, double? value)
        {
            AppendKey(sb, name);
            if (value.HasValue)
            {
                sb.Append(FormatDouble(value.Value));
            }
            else
            {
                sb.Append("null");
            }
        }

        private static void AppendKey(StringBuilder sb, string name)
        {
            AppendQuoted(sb, name);
            sb.Append(':');
        }

        /// <summary>
        /// Formats a double as a JSON number using the round-trip format and
        /// invariant culture. JSON has no representation for NaN/Infinity, so
        /// those non-finite values are written as <c>null</c> to keep the
        /// payload valid rather than emitting an unparseable token.
        /// </summary>
        private static string FormatDouble(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                return "null";
            }

            // "R" gives a shortest round-trippable representation on
            // .NET Framework / netstandard2.0; invariant culture guarantees a
            // '.' decimal separator regardless of the host locale.
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Writes a JSON string literal with the minimal required escaping
        /// (RFC 8259): the quote, the backslash, and control characters below
        /// U+0020. Sufficient for symbol/contract identifiers and the fixed
        /// <c>type</c> discriminators.
        /// </summary>
        private static void AppendQuoted(StringBuilder sb, string value)
        {
            sb.Append('"');
            if (!string.IsNullOrEmpty(value))
            {
                foreach (var c in value)
                {
                    switch (c)
                    {
                        case '"':
                            sb.Append("\\\"");
                            break;
                        case '\\':
                            sb.Append("\\\\");
                            break;
                        case '\b':
                            sb.Append("\\b");
                            break;
                        case '\f':
                            sb.Append("\\f");
                            break;
                        case '\n':
                            sb.Append("\\n");
                            break;
                        case '\r':
                            sb.Append("\\r");
                            break;
                        case '\t':
                            sb.Append("\\t");
                            break;
                        default:
                            if (c < '\u0020')
                            {
                                sb.Append("\\u");
                                sb.Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                            }
                            else
                            {
                                sb.Append(c);
                            }

                            break;
                    }
                }
            }

            sb.Append('"');
        }
    }
}
