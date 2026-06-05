using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Identity of a market-data Stream: the tuple (symbol, contract, channel).
    /// Per-stream sequence assignment is monotonic within a single StreamId and
    /// independent across StreamIds. (Glossary: Stream; Req 1.3)
    ///
    /// Value-equality is used so the same logical stream maps to the same
    /// sequence counter regardless of identity.
    /// </summary>
    public readonly struct StreamId : IEquatable<StreamId>
    {
        /// <summary>User-facing symbol, e.g. "GC".</summary>
        public string Symbol { get; }

        /// <summary>Resolved real contract, e.g. "GC 08-26".</summary>
        public string Contract { get; }

        /// <summary>Trade or quote channel.</summary>
        public Channel Channel { get; }

        public StreamId(string symbol, string contract, Channel channel)
        {
            Symbol = symbol ?? throw new ArgumentNullException(nameof(symbol));
            Contract = contract ?? throw new ArgumentNullException(nameof(contract));
            Channel = channel;
        }

        public bool Equals(StreamId other) =>
            string.Equals(Symbol, other.Symbol, StringComparison.Ordinal) &&
            string.Equals(Contract, other.Contract, StringComparison.Ordinal) &&
            Channel == other.Channel;

        public override bool Equals(object? obj) => obj is StreamId other && Equals(other);

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = (hash * 31) + (Symbol?.GetHashCode() ?? 0);
                hash = (hash * 31) + (Contract?.GetHashCode() ?? 0);
                hash = (hash * 31) + (int)Channel;
                return hash;
            }
        }

        public override string ToString() => $"{Symbol}:{Contract}:{Channel}";
    }
}
