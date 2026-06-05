namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// The frame kind used when sending or receiving a message over an
    /// <see cref="IWebSocketClient"/>.
    ///
    /// <para>The NT_AddOn uses the frame kind as the on-the-wire discriminator
    /// for whether a payload is compressed (design "Background Worker:
    /// serialize + compress + send", Req 2.2):</para>
    /// <list type="bullet">
    ///   <item><description>
    ///   <see cref="Text"/> — the payload is raw UTF-8 JSON (compression
    ///   disabled). This matches the documented <c>/ws/nt</c> trade/quote
    ///   message shapes exactly.
    ///   </description></item>
    ///   <item><description>
    ///   <see cref="Binary"/> — the payload is the GZip-compressed bytes of the
    ///   same UTF-8 JSON (compression enabled via
    ///   <see cref="NtAddOn.Core.Configuration.AddOnConfig.CompressionEnabled"/>).
    ///   </description></item>
    /// </list>
    /// </summary>
    public enum WebSocketMessageKind
    {
        /// <summary>A UTF-8 text frame (raw JSON).</summary>
        Text = 0,

        /// <summary>A binary frame (e.g. GZip-compressed JSON).</summary>
        Binary = 1,
    }
}
