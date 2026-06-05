using NtAddOn.Core.MarketData;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Serializes a normalized market-data event into the exact JSON wire shape
    /// documented for the <c>/ws/nt</c> data plane (design "WebSocket Message
    /// Schemas"; Req 1.1, 1.2). This is the serialization step the background
    /// sender worker (task 4.7) performs OFF the NinjaTrader callback path —
    /// never inline in the callback (Req 2.1–2.3).
    ///
    /// <para>It is a seam so the worker can be unit/property-tested against a
    /// known serializer and so the control-plane/status path (task 4.10) can
    /// reuse the same canonical formatting for the <c>status</c> message.</para>
    /// </summary>
    public interface INormalizedEventSerializer
    {
        /// <summary>
        /// Serializes a buffered event (a <see cref="NormalizedTrade"/> or
        /// <see cref="NormalizedQuote"/>) to its documented JSON shape. Throws
        /// when the runtime type is not a recognized normalized event so the
        /// worker can log and skip a malformed item rather than send garbage.
        /// </summary>
        string Serialize(INormalizedEvent ev);
    }
}
