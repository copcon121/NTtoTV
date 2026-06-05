using System;
using System.Collections.Generic;
using NtAddOn.Core.Configuration;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// The NT_AddOn control plane (task 4.10): the single platform-agnostic
    /// coordinator that the background worker's <c>/ws/nt</c> receive loop and
    /// the AddOn start path drive. It ties together the start-up subscription to
    /// all Candidate_Contracts (Req 1.5), inbound Control_Command handling
    /// (Req 1.7, 1.8), and connection-status emission (Req 3.4, 20.1) behind one
    /// surface so the transport layer (sender worker — task 4.7; reconnect loop —
    /// task 4.8) stays decoupled from the subscription/status semantics.
    ///
    /// <para>It owns a <see cref="SubscriptionManager"/> (which calls the
    /// NinjaTrader <see cref="IContractSubscriber"/> seam) and a
    /// <see cref="ConnectionStatusEmitter"/> (which raises the design's
    /// <c>StatusChanged</c> event). Everything here is unit/property-testable
    /// with an in-memory <see cref="IContractSubscriber"/> and a fake clock; no
    /// NinjaTrader or network dependency is involved.</para>
    /// </summary>
    public sealed class ControlPlane
    {
        private readonly SubscriptionManager _subscriptions;
        private readonly ConnectionStatusEmitter _status;

        /// <summary>
        /// Creates a control plane over the given <paramref name="subscriber"/>
        /// seam. An optional <paramref name="clockMs"/> supplies the
        /// Canonical_Timestamp for status payloads (defaults to UTC now).
        /// </summary>
        public ControlPlane(IContractSubscriber subscriber, Func<long>? clockMs = null)
            : this(new SubscriptionManager(subscriber), new ConnectionStatusEmitter(clockMs))
        {
        }

        /// <summary>
        /// Creates a control plane over an explicit subscription manager and
        /// status emitter. Primarily for tests that need to observe both
        /// collaborators directly.
        /// </summary>
        public ControlPlane(SubscriptionManager subscriptions, ConnectionStatusEmitter status)
        {
            _subscriptions = subscriptions ?? throw new ArgumentNullException(nameof(subscriptions));
            _status = status ?? throw new ArgumentNullException(nameof(status));
        }

        /// <summary>The subscription manager owning the active contract set.</summary>
        public SubscriptionManager Subscriptions => _subscriptions;

        /// <summary>The status emitter raising connection-state changes.</summary>
        public ConnectionStatusEmitter Status => _status;

        /// <summary>
        /// The design's <c>event Action&lt;ConnectionStatus&gt; StatusChanged</c>
        /// (Req 3.4, 20.1), surfaced on the control plane for convenience.
        /// </summary>
        public event Action<ConnectionStatus>? StatusChanged
        {
            add => _status.StatusChanged += value;
            remove => _status.StatusChanged -= value;
        }

        /// <summary>
        /// Companion event carrying the full <see cref="StatusEvent"/> payload to
        /// forward to the Backend over <c>/ws/nt</c> in the documented JSON shape.
        /// </summary>
        public event Action<StatusEvent>? StatusChangedEvent
        {
            add => _status.StatusChangedEvent += value;
            remove => _status.StatusChangedEvent -= value;
        }

        /// <summary>
        /// The currently active subscription set (Req 1.5, 1.7, 1.8).
        /// </summary>
        public IReadOnlyList<string> ActiveContracts => _subscriptions.ActiveContracts;

        /// <summary>The last reported connection state.</summary>
        public ConnectionStatus ConnectionState => _status.Current;

        /// <summary>
        /// Start-up subscription (Req 1.5): subscribes to the Level 1 trade and
        /// quote feeds of every configured Candidate_Contract. Returns the
        /// contracts that were newly subscribed.
        /// </summary>
        public IReadOnlyList<string> Start(AddOnConfig config)
        {
            if (config == null)
            {
                throw new ArgumentNullException(nameof(config));
            }

            return _subscriptions.SubscribeToAll(config.CandidateContracts);
        }

        /// <summary>
        /// Applies a parsed inbound Control_Command (Req 1.7, 1.8). This is the
        /// design's <c>void OnControlCommand(ControlCommand cmd)</c> seam.
        /// Returns <see langword="true"/> when the active set changed.
        /// </summary>
        public bool OnControlCommand(ControlCommand command) =>
            _subscriptions.OnControlCommand(command);

        /// <summary>
        /// Handles a raw inbound <c>/ws/nt</c> frame: parses it as a
        /// Control_Command and applies it (Req 1.7, 1.8). Non-control frames
        /// (heartbeats, malformed JSON, unknown actions) are ignored and return
        /// <see langword="false"/>, so the receive loop can pass every frame here
        /// without pre-filtering. Returns <see langword="true"/> only when a
        /// valid control command actually changed the active set.
        /// </summary>
        public bool OnControlMessage(string rawJson)
        {
            return ControlCommand.TryParse(rawJson, out var command) &&
                   _subscriptions.OnControlCommand(command!);
        }

        /// <summary>
        /// Reports the current observed connection state (Req 3.4, 20.1); raises
        /// the status events only on an actual change. Convenience pass-through
        /// to the <see cref="ConnectionStatusEmitter"/> for the transport layer.
        /// </summary>
        public bool ReportStatus(ConnectionStatus state, string? contract = null) =>
            _status.Report(state, contract);
    }
}
