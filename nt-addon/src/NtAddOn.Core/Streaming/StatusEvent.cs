using System;
using System.Globalization;
using System.Text;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// The status event the NT_AddOn emits to the Backend over <c>/ws/nt</c>
    /// when its connection state changes (Req 3.4, 20.1).
    ///
    /// <para>Documented wire shape (design "WebSocket Message Schemas → Status
    /// event (NT_AddOn → Backend)"):</para>
    /// <code>
    /// { "type": "status", "source": "nt_addon", "state": "connected", "time": 1730313600200 }
    /// </code>
    /// <para><c>state</c> ∈ <c>connected | degraded | disconnected</c>;
    /// <c>contract</c> MAY be included when the status is contract-specific.</para>
    ///
    /// <para>This is an immutable, platform-agnostic value type so the status
    /// payload can be constructed and serialized without NinjaTrader present.
    /// Serialization is hand-rolled (no third-party JSON dependency) to keep
    /// <c>NtAddOn.Core</c> dependency-free on <c>netstandard2.0</c>.</para>
    /// </summary>
    public sealed class StatusEvent
    {
        /// <summary>Wire discriminator value for a status message.</summary>
        public const string StatusType = "status";

        /// <summary>The <c>source</c> value identifying the NT_AddOn.</summary>
        public const string NtAddOnSource = "nt_addon";

        /// <summary>The connection state being reported (Req 3.4, 20.1).</summary>
        public ConnectionStatus State { get; }

        /// <summary>The message source; "nt_addon" for events the AddOn emits.</summary>
        public string Source { get; }

        /// <summary>Canonical_Timestamp of the event (ms since Unix epoch UTC).</summary>
        public long TimeMs { get; }

        /// <summary>
        /// Optional contract identifier when the status is contract-specific;
        /// <c>null</c> for a connection-wide status.
        /// </summary>
        public string? Contract { get; }

        /// <summary>Constructs a status event.</summary>
        public StatusEvent(ConnectionStatus state, long timeMs, string? contract = null, string source = NtAddOnSource)
        {
            State = state;
            TimeMs = timeMs;
            Contract = string.IsNullOrWhiteSpace(contract) ? null : contract!.Trim();
            Source = string.IsNullOrWhiteSpace(source) ? NtAddOnSource : source;
        }

        /// <summary>
        /// Maps a <see cref="ConnectionStatus"/> to its wire <c>state</c> string
        /// (<c>connected</c>/<c>degraded</c>/<c>disconnected</c>).
        /// </summary>
        public static string ToWireState(ConnectionStatus state)
        {
            switch (state)
            {
                case ConnectionStatus.Connected:
                    return "connected";
                case ConnectionStatus.Degraded:
                    return "degraded";
                case ConnectionStatus.Disconnected:
                    return "disconnected";
                default:
                    throw new ArgumentOutOfRangeException(nameof(state), state, "Unknown connection status.");
            }
        }

        /// <summary>
        /// Serializes this status event to the documented JSON wire shape. Field
        /// order matches the design schema; <c>contract</c> is included only when
        /// present.
        /// </summary>
        public string ToJson()
        {
            var sb = new StringBuilder(96);
            sb.Append('{');
            sb.Append("\"type\":\"").Append(StatusType).Append("\",");
            sb.Append("\"source\":").Append(EncodeString(Source)).Append(',');
            sb.Append("\"state\":\"").Append(ToWireState(State)).Append('"');
            if (Contract != null)
            {
                sb.Append(",\"contract\":").Append(EncodeString(Contract));
            }

            sb.Append(",\"time\":").Append(TimeMs.ToString(CultureInfo.InvariantCulture));
            sb.Append('}');
            return sb.ToString();
        }

        /// <inheritdoc />
        public override string ToString() => ToJson();

        private static string EncodeString(string value)
        {
            var sb = new StringBuilder(value.Length + 2);
            sb.Append('"');
            foreach (var c in value)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }

                        break;
                }
            }

            sb.Append('"');
            return sb.ToString();
        }
    }
}
