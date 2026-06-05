using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NtAddOn.Core.Streaming;
using Xunit;

namespace NtAddOn.Tests.Streaming
{
    /// <summary>
    /// Unit tests for the async control flow of <see cref="ReconnectLoop"/>
    /// (task 4.8, Req 3.1–3.3). The delay function and random source are injected
    /// so the loop runs without real time passing and with deterministic jitter.
    /// </summary>
    public class ReconnectLoopTests
    {
        [Fact]
        public async Task RunReconnectLoop_FirstAttemptSucceeds_NoDelay()
        {
            var delays = new List<TimeSpan>();
            int connectCalls = 0;

            var loop = new ReconnectLoop(
                random: new FixedRandomSource(0.0),
                delay: (d, ct) => { delays.Add(d); return Task.CompletedTask; });

            await loop.RunReconnectLoopAsync(
                ct => { connectCalls++; return Task.CompletedTask; },
                CancellationToken.None);

            Assert.Equal(1, connectCalls);
            Assert.Empty(delays); // no delay before the first attempt
        }

        [Fact]
        public async Task RunReconnectLoop_RetriesUntilSuccess_UsingFibonacciDelays()
        {
            var delays = new List<TimeSpan>();
            int connectCalls = 0;

            // Fail the first 4 attempts, then connect on the 5th.
            var loop = new ReconnectLoop(
                random: new FixedRandomSource(0.0), // zero jitter -> pure Fibonacci base
                delay: (d, ct) => { delays.Add(d); return Task.CompletedTask; });

            await loop.RunReconnectLoopAsync(
                ct =>
                {
                    connectCalls++;
                    if (connectCalls < 5)
                    {
                        throw new InvalidOperationException("connect failed");
                    }

                    return Task.CompletedTask;
                },
                CancellationToken.None);

            Assert.Equal(5, connectCalls);

            // One delay between each of the 4 failures and the next attempt:
            // attempts 0..3 -> Fibonacci base 1,1,2,3 seconds (Req 3.1).
            Assert.Equal(4, delays.Count);
            Assert.Equal(1.0, delays[0].TotalSeconds, precision: 9);
            Assert.Equal(1.0, delays[1].TotalSeconds, precision: 9);
            Assert.Equal(2.0, delays[2].TotalSeconds, precision: 9);
            Assert.Equal(3.0, delays[3].TotalSeconds, precision: 9);
        }

        [Fact]
        public async Task RunReconnectLoop_AppliesJitterFromRandomSource()
        {
            var delays = new List<TimeSpan>();
            int connectCalls = 0;

            var loop = new ReconnectLoop(
                random: new FixedRandomSource(1.0), // max jitter
                delay: (d, ct) => { delays.Add(d); return Task.CompletedTask; });

            await loop.RunReconnectLoopAsync(
                ct =>
                {
                    connectCalls++;
                    if (connectCalls < 2)
                    {
                        throw new InvalidOperationException("connect failed");
                    }

                    return Task.CompletedTask;
                },
                CancellationToken.None);

            // attempt 0 -> base 1s + 20% max jitter = 1.2s (Req 3.2).
            Assert.Single(delays);
            Assert.Equal(1.2, delays[0].TotalSeconds, precision: 9);
        }

        [Fact]
        public async Task RunReconnectLoop_DelaysAreCappedAtSixtySeconds()
        {
            var delays = new List<TimeSpan>();
            int connectCalls = 0;

            var loop = new ReconnectLoop(
                random: new FixedRandomSource(1.0),
                delay: (d, ct) => { delays.Add(d); return Task.CompletedTask; });

            // Fail 12 times so the Fibonacci base climbs past the cap.
            await loop.RunReconnectLoopAsync(
                ct =>
                {
                    connectCalls++;
                    if (connectCalls <= 12)
                    {
                        throw new InvalidOperationException("connect failed");
                    }

                    return Task.CompletedTask;
                },
                CancellationToken.None);

            // Req 3.3: no scheduled delay ever exceeds 60s.
            Assert.All(delays, d => Assert.True(d.TotalSeconds <= FibonacciBackoff.DefaultCapSeconds + 1e-9));
            // The later attempts must have actually reached the cap.
            Assert.Contains(delays, d => Math.Abs(d.TotalSeconds - 60.0) < 1e-9);
        }

        [Fact]
        public async Task RunReconnectLoop_CancellationDuringBackoffWait_Throws()
        {
            using var cts = new CancellationTokenSource();
            int connectCalls = 0;

            // Delay function observes cancellation: cancel then throw like Task.Delay would.
            var loop = new ReconnectLoop(
                random: new FixedRandomSource(0.0),
                delay: (d, ct) =>
                {
                    cts.Cancel();
                    ct.ThrowIfCancellationRequested();
                    return Task.CompletedTask;
                });

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                loop.RunReconnectLoopAsync(
                    ct =>
                    {
                        connectCalls++;
                        throw new InvalidOperationException("connect failed");
                    },
                    cts.Token));

            // Only one connect attempt; cancellation during the wait stops the loop.
            Assert.Equal(1, connectCalls);
        }

        [Fact]
        public async Task RunReconnectLoop_AlreadyCanceled_DoesNotAttemptConnect()
        {
            using var cts = new CancellationTokenSource();
            cts.Cancel();
            int connectCalls = 0;

            var loop = new ReconnectLoop(delay: (d, ct) => Task.CompletedTask);

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                loop.RunReconnectLoopAsync(
                    ct => { connectCalls++; return Task.CompletedTask; },
                    cts.Token));

            Assert.Equal(0, connectCalls);
        }

        [Fact]
        public async Task RunReconnectLoop_InvokesRetryHookForEachScheduledRetry()
        {
            var hookCalls = new List<ReconnectAttemptInfo>();
            int connectCalls = 0;

            var loop = new ReconnectLoop(
                random: new FixedRandomSource(0.0),
                delay: (d, ct) => Task.CompletedTask,
                onRetryScheduled: info => hookCalls.Add(info));

            await loop.RunReconnectLoopAsync(
                ct =>
                {
                    connectCalls++;
                    if (connectCalls < 3)
                    {
                        throw new InvalidOperationException("boom");
                    }

                    return Task.CompletedTask;
                },
                CancellationToken.None);

            Assert.Equal(2, hookCalls.Count);
            Assert.Equal(0, hookCalls[0].AttemptIndex);
            Assert.Equal(1, hookCalls[1].AttemptIndex);
            Assert.All(hookCalls, info => Assert.IsType<InvalidOperationException>(info.Error));
        }

        [Fact]
        public async Task RunReconnectLoop_NullConnect_Throws()
        {
            var loop = new ReconnectLoop();
            await Assert.ThrowsAsync<ArgumentNullException>(() =>
                loop.RunReconnectLoopAsync(null!, CancellationToken.None));
        }

        private sealed class FixedRandomSource : IRandomSource
        {
            private readonly double _value;
            public FixedRandomSource(double value) => _value = value;
            public double NextDouble() => _value;
        }
    }
}
