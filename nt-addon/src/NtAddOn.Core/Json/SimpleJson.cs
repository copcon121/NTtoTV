using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace NtAddOn.Core.Json
{
    /// <summary>
    /// A small, dependency-free JSON reader used by the NT_AddOn to parse the
    /// flat inbound Control_Command messages the Backend sends over
    /// <c>/ws/nt</c> (design "WebSocket Message Schemas"; Req 1.7, 1.8).
    ///
    /// <para><b>Why hand-rolled?</b> <c>NtAddOn.Core</c> targets
    /// <c>netstandard2.0</c> and intentionally carries no third-party
    /// dependencies (no <c>System.Text.Json</c>, no Newtonsoft) so it builds and
    /// runs on any machine, including NinjaTrader 8's .NET Framework 4.8 host.
    /// This parser is deliberately minimal but a correct recursive-descent
    /// implementation of the JSON grammar (RFC 8259) for objects, arrays,
    /// strings, numbers, <c>true</c>/<c>false</c>, and <c>null</c>.</para>
    ///
    /// <para>Parsed values map to: object → <see cref="IReadOnlyDictionary{TKey,TValue}"/>
    /// of <see cref="string"/>→<see cref="object"/>?, array →
    /// <see cref="IReadOnlyList{T}"/> of <see cref="object"/>?, string →
    /// <see cref="string"/>, number → <see cref="double"/>, boolean →
    /// <see cref="bool"/>, and JSON <c>null</c> → <see langword="null"/>.</para>
    ///
    /// <para>The parser is allocation-light and side-effect free, so it is safe
    /// to call from the background worker's receive loop. It does not preserve
    /// number formatting (numbers become <see cref="double"/>); callers that
    /// need an integral value (e.g. the Canonical_Timestamp) should round.</para>
    /// </summary>
    public static class SimpleJson
    {
        /// <summary>
        /// Parses a complete JSON document and returns the root value, or throws
        /// <see cref="FormatException"/> when the text is not valid JSON or has
        /// trailing content after the root value.
        /// </summary>
        public static object? Parse(string text)
        {
            if (text == null)
            {
                throw new ArgumentNullException(nameof(text));
            }

            var parser = new Parser(text);
            parser.SkipWhitespace();
            var value = parser.ParseValue();
            parser.SkipWhitespace();
            if (!parser.AtEnd)
            {
                throw new FormatException("Unexpected trailing content after JSON value.");
            }

            return value;
        }

        /// <summary>
        /// Attempts to parse a JSON document. Returns <see langword="true"/> and
        /// the root value on success; returns <see langword="false"/> (never
        /// throws) when the text is null or not valid JSON.
        /// </summary>
        public static bool TryParse(string text, out object? value)
        {
            value = null;
            if (text == null)
            {
                return false;
            }

            try
            {
                value = Parse(text);
                return true;
            }
            catch (FormatException)
            {
                return false;
            }
        }

        private sealed class Parser
        {
            private readonly string _s;
            private int _i;

            public Parser(string s)
            {
                _s = s;
                _i = 0;
            }

            public bool AtEnd => _i >= _s.Length;

            public void SkipWhitespace()
            {
                while (_i < _s.Length)
                {
                    var c = _s[_i];
                    if (c == ' ' || c == '\t' || c == '\n' || c == '\r')
                    {
                        _i++;
                    }
                    else
                    {
                        break;
                    }
                }
            }

            public object? ParseValue()
            {
                if (AtEnd)
                {
                    throw new FormatException("Unexpected end of JSON input.");
                }

                var c = _s[_i];
                switch (c)
                {
                    case '{':
                        return ParseObject();
                    case '[':
                        return ParseArray();
                    case '"':
                        return ParseString();
                    case 't':
                    case 'f':
                        return ParseBool();
                    case 'n':
                        ParseLiteral("null");
                        return null;
                    default:
                        if (c == '-' || (c >= '0' && c <= '9'))
                        {
                            return ParseNumber();
                        }

                        throw new FormatException($"Unexpected character '{c}' at position {_i}.");
                }
            }

            private IReadOnlyDictionary<string, object?> ParseObject()
            {
                Expect('{');
                var result = new Dictionary<string, object?>(StringComparer.Ordinal);
                SkipWhitespace();
                if (!AtEnd && _s[_i] == '}')
                {
                    _i++;
                    return result;
                }

                while (true)
                {
                    SkipWhitespace();
                    if (AtEnd || _s[_i] != '"')
                    {
                        throw new FormatException($"Expected object key string at position {_i}.");
                    }

                    var key = ParseString();
                    SkipWhitespace();
                    Expect(':');
                    SkipWhitespace();
                    var value = ParseValue();

                    // Last-write-wins on duplicate keys, matching common parsers.
                    result[key] = value;

                    SkipWhitespace();
                    if (AtEnd)
                    {
                        throw new FormatException("Unterminated object.");
                    }

                    var c = _s[_i];
                    if (c == ',')
                    {
                        _i++;
                        continue;
                    }

                    if (c == '}')
                    {
                        _i++;
                        return result;
                    }

                    throw new FormatException($"Expected ',' or '}}' at position {_i}.");
                }
            }

            private IReadOnlyList<object?> ParseArray()
            {
                Expect('[');
                var result = new List<object?>();
                SkipWhitespace();
                if (!AtEnd && _s[_i] == ']')
                {
                    _i++;
                    return result;
                }

                while (true)
                {
                    SkipWhitespace();
                    result.Add(ParseValue());
                    SkipWhitespace();
                    if (AtEnd)
                    {
                        throw new FormatException("Unterminated array.");
                    }

                    var c = _s[_i];
                    if (c == ',')
                    {
                        _i++;
                        continue;
                    }

                    if (c == ']')
                    {
                        _i++;
                        return result;
                    }

                    throw new FormatException($"Expected ',' or ']' at position {_i}.");
                }
            }

            private string ParseString()
            {
                Expect('"');
                var sb = new StringBuilder();
                while (true)
                {
                    if (AtEnd)
                    {
                        throw new FormatException("Unterminated string.");
                    }

                    var c = _s[_i++];
                    if (c == '"')
                    {
                        return sb.ToString();
                    }

                    if (c == '\\')
                    {
                        if (AtEnd)
                        {
                            throw new FormatException("Unterminated escape sequence.");
                        }

                        var esc = _s[_i++];
                        switch (esc)
                        {
                            case '"': sb.Append('"'); break;
                            case '\\': sb.Append('\\'); break;
                            case '/': sb.Append('/'); break;
                            case 'b': sb.Append('\b'); break;
                            case 'f': sb.Append('\f'); break;
                            case 'n': sb.Append('\n'); break;
                            case 'r': sb.Append('\r'); break;
                            case 't': sb.Append('\t'); break;
                            case 'u':
                                sb.Append(ParseUnicodeEscape());
                                break;
                            default:
                                throw new FormatException($"Invalid escape '\\{esc}' at position {_i - 1}.");
                        }
                    }
                    else if (c < 0x20)
                    {
                        throw new FormatException($"Unescaped control character in string at position {_i - 1}.");
                    }
                    else
                    {
                        sb.Append(c);
                    }
                }
            }

            private char ParseUnicodeEscape()
            {
                if (_i + 4 > _s.Length)
                {
                    throw new FormatException("Incomplete \\u escape sequence.");
                }

                var hex = _s.Substring(_i, 4);
                if (!ushort.TryParse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var code))
                {
                    throw new FormatException($"Invalid \\u escape '\\u{hex}'.");
                }

                _i += 4;
                return (char)code;
            }

            private bool ParseBool()
            {
                if (_s[_i] == 't')
                {
                    ParseLiteral("true");
                    return true;
                }

                ParseLiteral("false");
                return false;
            }

            private void ParseLiteral(string literal)
            {
                if (_i + literal.Length > _s.Length ||
                    string.CompareOrdinal(_s, _i, literal, 0, literal.Length) != 0)
                {
                    throw new FormatException($"Invalid literal at position {_i}; expected '{literal}'.");
                }

                _i += literal.Length;
            }

            private double ParseNumber()
            {
                var start = _i;
                if (_i < _s.Length && _s[_i] == '-')
                {
                    _i++;
                }

                while (_i < _s.Length)
                {
                    var c = _s[_i];
                    if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-')
                    {
                        _i++;
                    }
                    else
                    {
                        break;
                    }
                }

                var token = _s.Substring(start, _i - start);
                if (!double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
                {
                    throw new FormatException($"Invalid number '{token}' at position {start}.");
                }

                return value;
            }

            private void Expect(char c)
            {
                if (AtEnd || _s[_i] != c)
                {
                    throw new FormatException($"Expected '{c}' at position {_i}.");
                }

                _i++;
            }
        }
    }
}
