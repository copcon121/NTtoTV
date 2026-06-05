using System;
using System.Threading;
using System.Threading.Tasks;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Drives the NT_AddOn → Backend reconnect loop using Fibonacci backoff with
    /// randomized jitter, capped at 60s, and fully cancellation-aware
    /// (Req 3.1–3.3). This implements the <c>RunReconnectLoopAsync</c> behaviour
    /// from the design's NT_AddOn interface sketch.
    ///
    /// <para><b>Separation of concerns.</b> All delay arithmetic lives in the
    /// pure <see cref="FibonacciBackoff"/> calculator; this class owns only the
    /// asynchronous control flow — attempt, on failure compute the delay, wait,
    /// retry — so the timing policy is property-tested independently of the
    /// async waiting (Property 4, task 4.9).</para>
    ///
    /// <para><b>Integration seam (parallel work with task 4.7).</b> Task 4.7
    /// introduces the WebSocket transport (an <c>IWebSocketClient</c>). Because
    /// that seam does not exist yet, this loop depends only on a minimal
    /// <b>connect delegate</b> — <see cref="ConnectAsync"/> — and an injectable
    /// <b>delay function</b> — <see cref="DelayAsync"/>. When 4.7 lands, its
    /// transport's connect method (e.g. <c>IWebSocketClient.ConnectAsync</c>) is
    /// the natural value to pass as <see cref="ConnectAsync"/>; no change to this
    /// loop is required. The connect delegate is expected to throw on a failed
    /// connection and to honour its <see cref="CancellationToken"/>.</para>
    ///
    /// <para><b>Status events.</b> This loop does not emit
    /// connected/degraded/disconnected status events; that is the responsibility
    /// of the status/control-plane work in task 4.10 (Req 3.4, 20.1). An optional
    /// <see cref="OnRetryScheduled"/> hook is provided purely for logging/diagnostics
    /// of scheduled retries.</para>
    /// </summary>
    public sealed class ReconnectLoop
    {
        /// <summary>
        /// Connect attempt. Implementations open the WebSocket connection to the
        /// Backend and return when connected, or <b>throw</b> to signal a failed
        /// attempt that should be retried. Must observe the supplied
        /// <see cref="CancellationToken"/>.
        /// </summary>
        /// <param name="ct">Cancellation token for the connect attempt.</param>
        /// <returns>A task that completes when the connection is established.</returns>
        public delegate Task ConnectAsync(CancellationToken ct);

        /// <summary>
        /// Asynchronous delay function. Production passes
        /// <see cref="Task.Delay(TimeSpan, CancellationToken)"/>; tests pass a
        /// fake that records the requested delay and returns immediately, so the
        /// loop can be exercised without real time passing.
        /// </summary>
        /// <param name="delay">The backoff delay to wait.</param>
        /// <param name="ct">Cancellation token; cancellation aborts the wait.</param>
        /// <returns>A task that completes when the delay elapses.</returns>
        public delegate Task DelayAsync(TimeSpan delay, CancellationToken ct);

        private readonly FibonacciBackoff _backoff;
        private readonly IRandomSource _random;
        private readonly DelayAsync _delay;
        private readonly Action<ReconnectAttemptInfo>? _onRetryScheduled;

        /// <summary>
        /// Creates a reconnect loop.
        /// </summary>
        /// <param name="backoff">
        /// Pure backoff calculator (Fibonacci base, jitter bounds, cap). Defaults
        /// to a new <see cref="FibonacciBackoff"/> (60s cap, 20% jitter) when null.
        /// </param>
        /// <param name="random">
        /// Jitter source (Req 3.2). Defaults to <see cref="SystemRandomSource"/>
        /// when null.
        /// </param>
        /// <param name="delay">
        /// Delay function. Defaults to <see cref="Task.Delay(TimeSpan, CancellationToken)"/>
        /// when null; tests inject a fake to avoid real waiting.
        /// </param>
        /// <param name="onRetryScheduled">
        /// Optional diagnostics hook invoked just before each backoff wait with
        /// the attempt index, the chosen delay, and the failure. Not a status
        /// event (see class remarks).
        /// </param>
        public ReconnectLoop(
            FibonacciBackoff? backoff = null,
            IRandomSource? random = null,
            DelayAsync? delay = null,
            Action<ReconnectAttemptInfo>? onRetryScheduled = null)
        {
            _backoff = backoff ?? new FibonacciBackoff();
            _random = random ?? new SystemRandomSource();
            _delay = delay ?? ((d, ct) => Task.Delay(d, ct));
            _onRetryScheduled = onRetryScheduled;
        }

        /// <summary>
        /// The backoff calculator used by this loop. Exposed so callers and tests
        /// can inspect the Fibonacci base, jitter bounds, and cap directly.
        /// </summary>
        public FibonacciBackoff Backoff => _backoff;

        /// <summary>
        /// Repeatedly invokes <paramref name="connect"/> until it succeeds,
        /// waiting a Fibonacci-backoff delay (with jitter, capped at 60s) after
        /// each failed attempt (Req 3.1–3.3). Returns when a connection is
        /// established. The first attempt happens immediately (no initial delay);
        /// a delay is inserted only <i>between</i> failed attempts.
        ///
        /// <para>Fully cancellation-aware: if <paramref name="ct"/> is canceled
        /// — whether during a connect attempt or during a backoff wait — the
        /// method throws <see cref="OperationCanceledException"/> and performs no
        /// further attempts.</para>
        /// </summary>
        /// <param name="connect">
        /// The connect delegate (see <see cref="ConnectAsync"/>). When task 4.7's
        /// transport lands, pass its connect method here.
        /// </param>
        /// <param name="ct">Cancellation token controlling the whole loop.</param>
        /// <exception cref="OperationCanceledException">
        /// Thrown when <paramref name="ct"/> is canceled.
        /// </exception>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="connect"/> is null.
        /// </exception>
        public async Task RunReconnectLoopAsync(ConnectAsync connect, CancellationToken ct)
        {
            if (connect == null)
            {
                throw new ArgumentNullException(nameof(connect));
            }

            int attemptIndex = 0;

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    await connect(ct).ConfigureAwait(false);
                    return; // connected
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    // Cancellation is not a reconnect-worthy failure: propagate.
                    throw;
                }
                catch (Exception ex)
                {
                    // Failed attempt: schedule a backoff wait, then retry.
                    // If cancellation was requested concurrently with the
                    // failure, honour it instead of waiting.
                    ct.ThrowIfCancellationRequested();

                    TimeSpan delay = _backoff.ComputeDelay(attemptIndex, _random);
                    _onRetryScheduled?.Invoke(new ReconnectAttemptInfo(attemptIndex, delay, ex));

                    await _delay(delay, ct).ConfigureAwait(false);

                    // Advance the Fibonacci sequence for the next attempt,
                    // saturating so a very long-lived outage cannot overflow.
                    if (attemptIndex < int.MaxValue)
                    {
                        attemptIndex++;
                    }
                }
            }
        }
    }
}
