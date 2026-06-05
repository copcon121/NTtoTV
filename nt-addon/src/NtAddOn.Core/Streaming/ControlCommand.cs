using System;
using System.Collections.Generic;
using NtAddOn.Core.Json;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// An inbound Control_Command from the Backend over <c>/ws/nt</c> instructing
    /// the NT_AddOn to change which GC contracts it forwards (Req 1.7, 1.8, 4.6).
    ///
    /// <para>The documented wire shape (design "WebSocket Message Schemas →
    /// <c>/ws/nt</c> control plane") is a flat JSON object with one contract per
    /// command:</para>
    /// <code>
    /// { "type": "control", "action": "subscribe", "contract": "GC 10-26", "time": 1730313600300 }
    /// </code>
    /// <para><c>action</c> ∈ <c>subscribe | unsubscribe</c>; the Backend sends
    /// multiple commands when several contracts change.</para>
    ///
    /// <para>This is an immutable, platform-agnostic value type defined in
    /// <c>NtAddOn.Core</c> so the control-plane logic (parsing + subscription
    /// management) is fully testable without NinjaTrader present. The
    /// NinjaTrader-coupled subscribe/unsubscribe calls live behind
    /// <c>IContractSubscriber</c> in <c>NtAddOn.NinjaTrader</c>.</para>
    /// </summary>
    public sealed class ControlCommand
    {
        /// <summary>Wire discriminator value for a control message.</summary>
        public const string ControlType = "control";

        /// <summary>Wire <c>action</c> value for subscribe (Req 1.7).</summary>
        public const string SubscribeAction = "subscribe";

        /// <summary>Wire <c>action</c> value for unsubscribe (Req 1.8).</summary>
        public const string UnsubscribeAction = "unsubscribe";

        /// <summary>Subscribe or unsubscribe (Req 1.7, 1.8).</summary>
        public ControlAction Action { get; }

        /// <summary>
        /// The GC contract this command applies to, e.g. "GC 10-26". One
        /// contract per command (design schema).
        /// </summary>
        public string Contract { get; }

        /// <summary>
        /// The command's Canonical_Timestamp (ms since Unix epoch UTC), if the
        /// message carried a <c>time</c> field; otherwise <c>null</c>.
        /// </summary>
        public long? TimeMs { get; }

        /// <summary>
        /// Constructs a control command. <paramref name="contract"/> must be a
        /// non-empty contract identifier.
        /// </summary>
        public ControlCommand(ControlAction action, string contract, long? timeMs = null)
        {
            if (string.IsNullOrWhiteSpace(contract))
            {
                throw new ArgumentException("Control command contract must be non-empty.", nameof(contract));
            }

            Action = action;
            Contract = contract.Trim();
            TimeMs = timeMs;
        }

        /// <summary>
        /// Parses a raw inbound <c>/ws/nt</c> control message into a
        /// <see cref="ControlCommand"/>. Throws <see cref="FormatException"/> when
        /// the message is not valid JSON, is not a <c>type:"control"</c> object,
        /// has an unrecognized <c>action</c>, or is missing a <c>contract</c>.
        /// </summary>
        public static ControlCommand Parse(string json)
        {
            if (!TryParse(json, out var command, out var error))
            {
                throw new FormatException(error);
            }

            return command!;
        }

        /// <summary>
        /// Attempts to parse a raw inbound <c>/ws/nt</c> message into a
        /// <see cref="ControlCommand"/>. Returns <see langword="false"/> (never
        /// throws) for null/blank input, non-JSON, non-control messages, or
        /// control messages with an unknown action or a missing contract. This
        /// lets the receive loop ignore non-control frames (e.g. heartbeats)
        /// without exception handling on the hot path.
        /// </summary>
        public static bool TryParse(string json, out ControlCommand? command)
        {
            return TryParse(json, out command, out _);
        }

        private static bool TryParse(string json, out ControlCommand? command, out string? error)
        {
            command = null;
            error = null;

            if (string.IsNullOrWhiteSpace(json))
            {
                error = "Control message is null or empty.";
                return false;
            }

            if (!SimpleJson.TryParse(json, out var root))
            {
                error = "Control message is not valid JSON.";
                return false;
            }

            if (!(root is IReadOnlyDictionary<string, object?> obj))
            {
                error = "Control message must be a JSON object.";
                return false;
            }

            if (!TryGetString(obj, "type", out var type) ||
                !string.Equals(type, ControlType, StringComparison.Ordinal))
            {
                error = "Control message must have type \"control\".";
                return false;
            }

            if (!TryGetString(obj, "action", out var actionText))
            {
                error = "Control message is missing the \"action\" field.";
                return false;
            }

            ControlAction action;
            if (string.Equals(actionText, SubscribeAction, StringComparison.Ordinal))
            {
                action = ControlAction.Subscribe;
            }
            else if (string.Equals(actionText, UnsubscribeAction, StringComparison.Ordinal))
            {
                action = ControlAction.Unsubscribe;
            }
            else
            {
                error = $"Control message has unrecognized action \"{actionText}\".";
                return false;
            }

            if (!TryGetString(obj, "contract", out var contract) ||
                string.IsNullOrWhiteSpace(contract))
            {
                error = "Control message is missing a non-empty \"contract\".";
                return false;
            }

            long? timeMs = null;
            if (obj.TryGetValue("time", out var timeValue) && timeValue is double timeNumber)
            {
                timeMs = (long)Math.Round(timeNumber);
            }

            command = new ControlCommand(action, contract!, timeMs);
            return true;
        }

        private static bool TryGetString(
            IReadOnlyDictionary<string, object?> obj,
            string key,
            out string? value)
        {
            value = null;
            if (obj.TryGetValue(key, out var raw) && raw is string s)
            {
                value = s;
                return true;
            }

            return false;
        }

        /// <inheritdoc />
        public override string ToString() =>
            $"control {(Action == ControlAction.Subscribe ? SubscribeAction : UnsubscribeAction)} {Contract}";
    }
}
