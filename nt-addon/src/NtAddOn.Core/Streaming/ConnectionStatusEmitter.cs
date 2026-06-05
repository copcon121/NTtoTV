using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Tracks the NT_AddOn's connection state and raises a status event whenever
    /// the state changes (Req 3.4, 20.1).
    ///
    /// <para>The design's conceptual interface is
    /// <c>event Action&lt;ConnectionStatus&gt; StatusChanged</c>. This emitter
    /// owns that event and adds the surrounding semantics so the rest of the
    /// AddOn (the reconnect loop in task 4.8, the sender worker in task 4.7) can
    /// simply call <see cref="Report"/> on every connection-state observation:</para>
    /// <list type="bullet">
    ///   <item><description><b>Edge-triggered.</b> A status event is raised only
    ///   when the reported state differs from the last emitted state, so callers
    ///   can report the current state freely without producing duplicate
    ///   events.</description></item>
    ///   <item><description><b>Timestamped payload.</b> Each change also produces
    ///   a <see cref="StatusEvent"/> (via <see cref="StatusChangedEvent"/>) in the
    ///   documented wire shape, stamped with the Canonical_Timestamp from an
    ///   injected clock so it can be forwarded to the Backend over
    ///   <c>/ws/nt</c>.</description></item>
    /// </list>
    ///
    /// <para>The clock is injected (<see cref="Func{TResult}"/> returning ms
    /// since Unix epoch UTC) so tests are deterministic; the default uses
    /// <see cref="DateTimeOffset.UtcNow"/>. State transitions and event raising
    /// are serialized under a lock so concurrent reports from the worker and
    /// reconnect loop cannot interleave into an inconsistent state.</para>
    /// </summary>
    public sealed class ConnectionStatusEmitter
    {
        private readonly object _gate = new object();
        private readonly Func<long> _clockMs;

        private ConnectionStatus _current;
        private bool _hasEmitted;

        /// <summary>
        /// The design's status callback (Req 3.4, 20.1). Raised with the new
        /// <see cref="ConnectionStatus"/> on every state change.
        /// </summary>
        public event Action<ConnectionStatus>? StatusChanged;

        /// <summary>
        /// Companion event carrying the full <see cref="StatusEvent"/> payload
        /// (state + Canonical_Timestamp + optional contract) for forwarding to
        /// the Backend in the documented JSON shape.
        /// </summary>
        public event Action<StatusEvent>? StatusChangedEvent;

        /// <summary>
        /// Creates an emitter. <paramref name="clockMs"/> supplies the
        /// Canonical_Timestamp (ms since Unix epoch UTC) for each status payload;
        /// when <see langword="null"/>, <see cref="DateTimeOffset.UtcNow"/> is used.
        /// The initial state defaults to <see cref="ConnectionStatus.Disconnected"/>
        /// and is NOT emitted until the first differing <see cref="Report"/>.
        /// </summary>
        public ConnectionStatusEmitter(
            Func<long>? clockMs = null,
            ConnectionStatus initialState = ConnectionStatus.Disconnected)
        {
            _clockMs = clockMs ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            _current = initialState;
            _hasEmitted = false;
        }

        /// <summary>
        /// The last reported connection state. Equals the initial state until
        /// the first <see cref="Report"/>.
        /// </summary>
        public ConnectionStatus Current
        {
            get
            {
                lock (_gate)
                {
                    return _current;
                }
            }
        }

        /// <summary>
        /// Reports the current observed connection state (Req 3.4, 20.1). Raises
        /// <see cref="StatusChanged"/> and <see cref="StatusChangedEvent"/> only
        /// when <paramref name="state"/> differs from the last emitted state (or
        /// on the very first report). Returns <see langword="true"/> when an
        /// event was raised.
        /// </summary>
        /// <param name="state">The observed connection state.</param>
        /// <param name="contract">
        /// Optional contract identifier when the status is contract-specific.
        /// </param>
        public bool Report(ConnectionStatus state, string? contract = null)
        {
            StatusEvent? payload = null;

            lock (_gate)
            {
                if (_hasEmitted && state == _current)
                {
                    return false;
                }

                _current = state;
                _hasEmitted = true;
                payload = new StatusEvent(state, _clockMs(), contract);
            }

            // Raise outside the lock so subscriber callbacks cannot deadlock by
            // re-entering the emitter.
            StatusChanged?.Invoke(state);
            StatusChangedEvent?.Invoke(payload!);
            return true;
        }

        /// <summary>Convenience: report <see cref="ConnectionStatus.Connected"/>.</summary>
        public bool ReportConnected(string? contract = null) => Report(ConnectionStatus.Connected, contract);

        /// <summary>Convenience: report <see cref="ConnectionStatus.Degraded"/>.</summary>
        public bool ReportDegraded(string? contract = null) => Report(ConnectionStatus.Degraded, contract);

        /// <summary>Convenience: report <see cref="ConnectionStatus.Disconnected"/>.</summary>
        public bool ReportDisconnected(string? contract = null) => Report(ConnectionStatus.Disconnected, contract);
    }
}
