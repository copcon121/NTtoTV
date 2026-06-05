namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// The market-data channel of a <see cref="StreamId"/>. A Stream is the
    /// tuple (symbol, contract, channel); sequences are monotonic within a
    /// Stream and independent across Streams. (Glossary: Stream; Req 1.3)
    /// </summary>
    public enum Channel
    {
        /// <summary>Level 1 trade feed.</summary>
        Trade = 0,

        /// <summary>Level 1 quote (bid/ask) feed.</summary>
        Quote = 1,
    }
}
