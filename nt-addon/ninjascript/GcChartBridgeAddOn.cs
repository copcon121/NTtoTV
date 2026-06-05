// =============================================================================
// GC Chart Platform — self-contained NinjaScript AddOn
// =============================================================================
//
// DEPLOYMENT (no external build tools required):
//   1. Copy THIS FILE to:
//        Documents\NinjaTrader 8\bin\Custom\AddOns\GcChartBridgeAddOn.cs
//   2. In NinjaTrader: New > NinjaScript Editor, then press F5 (Compile), OR
//      restart NinjaTrader. NinjaTrader compiles it internally — no Visual
//      Studio / .NET SDK / MSBuild needed.
//   3. Make sure the backend is running (ws://127.0.0.1:8000/ws/nt) and a GC
//      data connection is live in NinjaTrader.
//
// NOTE: This file is written for NinjaTrader 8's NinjaScript compiler, which
// targets an older C# language version. It deliberately AVOIDS expression-bodied
// members (=>), the null-conditional operator (?.), string interpolation ($""),
// nameof, and out-var, all of which that compiler rejects. Lambdas, var, async/
// await, and auto-properties are fine.
//
// CONFIG (optional): Documents\NinjaTrader 8\gc-chart-bridge.json
//   {
//     "candidateContracts": ["GC 06-26", "GC 08-26", "GC 12-26"],
//     "backendHost": "127.0.0.1",
//     "backendPort": 8000,
//     "backendPath": "/ws/nt",
//     "outboundQueueCapacity": 200000,
//     "dropOnOverflow": false
//   }
// When absent, the defaults below are used. EDIT the contract months to match
// the GC contracts your data feed actually provides.
// =============================================================================

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.AddOns;

namespace NinjaTrader.NinjaScript.AddOns.GcChartBridge
{
    // -------------------------------------------------------------------------
    // AddOn entry point
    // -------------------------------------------------------------------------
    public class GcChartBridgeAddOn : AddOnBase
    {
        private GcBridgeRuntime runtime;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "GC Chart Bridge";
                Description = "Forwards GC Level 1 trade/quote data to the GC Chart Platform backend.";
            }
            else if (State == State.Configure)
            {
                if (runtime == null)
                {
                    try
                    {
                        GcBridgeConfig config = GcBridgeConfig.LoadOrDefault();
                        runtime = new GcBridgeRuntime(config, Log);
                        runtime.Start();
                    }
                    catch (Exception ex)
                    {
                        Log("failed to start: " + ex);
                    }
                }
            }
            else if (State == State.Terminated)
            {
                try
                {
                    if (runtime != null)
                        runtime.Dispose();
                }
                catch (Exception ex)
                {
                    Log("shutdown error: " + ex.Message);
                }
                runtime = null;
            }
        }

        private static void Log(string message)
        {
            try
            {
                NinjaTrader.Code.Output.Process("[GcChartBridge] " + message, PrintTo.OutputTab1);
            }
            catch
            {
                // Output may be unavailable during early startup
            }
        }
    }

    // -------------------------------------------------------------------------
    // Configuration (with optional JSON file)
    // -------------------------------------------------------------------------
    internal sealed class GcBridgeConfig
    {
        public List<string> CandidateContracts = new List<string> { "GC 08-26", "GC 10-26", "GC 12-26" };
        public string BackendHost = "127.0.0.1";
        public int BackendPort = 8000;
        public string BackendPath = "/ws/nt";
        public int OutboundQueueCapacity = 20000;
        public bool DropOnOverflow = true;

        public Uri BuildUri()
        {
            string path = BackendPath.StartsWith("/", StringComparison.Ordinal) ? BackendPath : "/" + BackendPath;
            return new Uri("ws://" + BackendHost + ":" + BackendPort + path);
        }

        public static GcBridgeConfig LoadOrDefault()
        {
            GcBridgeConfig cfg = new GcBridgeConfig();
            try
            {
                string path = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, "gc-chart-bridge.json");
                if (File.Exists(path))
                {
                    string text = File.ReadAllText(path);
                    cfg.ApplyJson(text);
                }
            }
            catch
            {
                // fall back to defaults on any read/parse error
            }
            return cfg;
        }

        // Minimal, tolerant extraction (avoids any JSON dependency). Looks for
        // the known keys; leaves defaults when a key is missing/unparseable.
        private void ApplyJson(string json)
        {
            List<string> contracts = ExtractStringArray(json, "candidateContracts");
            if (contracts.Count > 0)
                CandidateContracts = contracts;

            string host = ExtractString(json, "backendHost");
            if (!string.IsNullOrEmpty(host))
                BackendHost = host;

            string path = ExtractString(json, "backendPath");
            if (!string.IsNullOrEmpty(path))
                BackendPath = path;

            int port;
            if (ExtractInt(json, "backendPort", out port))
                BackendPort = port;

            int capacity;
            if (ExtractInt(json, "outboundQueueCapacity", out capacity) && capacity > 0)
                OutboundQueueCapacity = capacity;

            bool drop;
            if (ExtractBool(json, "dropOnOverflow", out drop))
                DropOnOverflow = drop;
        }

        private static string ExtractString(string json, string key)
        {
            int i = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (i < 0) return null;
            i = json.IndexOf(':', i);
            if (i < 0) return null;
            int q1 = json.IndexOf('"', i + 1);
            if (q1 < 0) return null;
            int q2 = json.IndexOf('"', q1 + 1);
            if (q2 < 0) return null;
            return json.Substring(q1 + 1, q2 - q1 - 1).Trim();
        }

        private static bool ExtractInt(string json, string key, out int value)
        {
            value = 0;
            int i = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (i < 0) return false;
            i = json.IndexOf(':', i);
            if (i < 0) return false;
            StringBuilder sb = new StringBuilder();
            for (int j = i + 1; j < json.Length; j++)
            {
                char c = json[j];
                if (char.IsDigit(c)) sb.Append(c);
                else if (sb.Length > 0) break;
                else if (c == ',' || c == '}') break;
            }
            return sb.Length > 0 && int.TryParse(sb.ToString(), out value);
        }

        private static bool ExtractBool(string json, string key, out bool value)
        {
            value = false;
            int i = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (i < 0) return false;
            i = json.IndexOf(':', i);
            if (i < 0) return false;
            int j = i + 1;
            while (j < json.Length && char.IsWhiteSpace(json[j])) j++;
            if (j + 4 <= json.Length &&
                string.Compare(json, j, "true", 0, 4, StringComparison.OrdinalIgnoreCase) == 0)
            {
                value = true;
                return true;
            }
            if (j + 5 <= json.Length &&
                string.Compare(json, j, "false", 0, 5, StringComparison.OrdinalIgnoreCase) == 0)
            {
                value = false;
                return true;
            }
            return false;
        }

        private static List<string> ExtractStringArray(string json, string key)
        {
            List<string> result = new List<string>();
            int i = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (i < 0) return result;
            int open = json.IndexOf('[', i);
            if (open < 0) return result;
            int close = json.IndexOf(']', open + 1);
            if (close < 0) return result;
            string inner = json.Substring(open + 1, close - open - 1);
            string[] parts = inner.Split(',');
            for (int p = 0; p < parts.Length; p++)
            {
                string part = parts[p];
                int q1 = part.IndexOf('"');
                int q2 = part.LastIndexOf('"');
                if (q1 >= 0 && q2 > q1)
                    result.Add(part.Substring(q1 + 1, q2 - q1 - 1).Trim());
            }
            return result;
        }
    }

    // -------------------------------------------------------------------------
    // Runtime: connection, subscriptions, normalization, sequencing, reconnect
    // -------------------------------------------------------------------------
    internal sealed class GcBridgeRuntime : IDisposable
    {
        private const string Symbol = "GC";

        private readonly GcBridgeConfig config;
        private readonly Action<string> log;
        private readonly Uri backendUri;

        // Outbound frame queue (string JSON), drained by the sender loop.
        private readonly BlockingCollection<string> outbound;

        // Per-stream monotonic sequence counters keyed by "contract|channel".
        private readonly Dictionary<string, long> sequences = new Dictionary<string, long>(StringComparer.Ordinal);
        private readonly object seqGate = new object();
        private readonly object overflowLogGate = new object();
        private long droppedFrames;
        private DateTime lastOverflowLogUtc = DateTime.MinValue;

        // Per-contract last-known quote snapshot.
        private readonly Dictionary<string, Snapshot> snapshots = new Dictionary<string, Snapshot>(StringComparer.Ordinal);
        private readonly object snapGate = new object();

        // Active subscriptions: contract -> Instrument + handler.
        private readonly Dictionary<string, Sub> subs = new Dictionary<string, Sub>(StringComparer.Ordinal);
        private readonly object subGate = new object();

        private ClientWebSocket socket;
        private CancellationTokenSource cts;
        private Task senderTask;
        private Task receiveTask;
        private Task heartbeatTask;
        private EventHandler<ConnectionStatusEventArgs> connStatusHandler;
        private volatile bool connected;
        private bool disposed;

        public GcBridgeRuntime(GcBridgeConfig config, Action<string> log)
        {
            this.config = config;
            this.log = log != null ? log : delegate { };
            this.backendUri = config.BuildUri();
            this.outbound = new BlockingCollection<string>(config.OutboundQueueCapacity);
        }

        public void Start()
        {
            cts = new CancellationTokenSource();
            CancellationToken token = cts.Token;
            senderTask = Task.Run(delegate { return SenderLoopAsync(token); });
            receiveTask = Task.Run(delegate { return ReceiveLoopAsync(token); });
            heartbeatTask = Task.Run(delegate { return HeartbeatLoopAsync(token); });

            // Watch NinjaTrader connection state. When a (re)connect completes,
            // refresh the Level 1 subscriptions so a feed restart keeps ticks
            // flowing without requiring an AddOn restart.
            connStatusHandler = delegate (object s, ConnectionStatusEventArgs e)
            {
                OnConnectionStatus(e);
            };
            Connection.ConnectionStatusUpdate += connStatusHandler;

            for (int i = 0; i < config.CandidateContracts.Count; i++)
                Subscribe(config.CandidateContracts[i]);

            log("started; forwarding " + string.Join(", ", config.CandidateContracts.ToArray()) +
                " to " + backendUri +
                "; queueCapacity=" + config.OutboundQueueCapacity.ToString(CultureInfo.InvariantCulture) +
                "; dropOnOverflow=" + config.DropOnOverflow.ToString());
        }

        // Re-subscribe all contracts when a data connection (re)connects, so
        // pause/resume of Playback (or a feed reconnect) keeps ticks flowing.
        private void OnConnectionStatus(ConnectionStatusEventArgs e)
        {
            try
            {
                if (e == null) return;
                // Only act when a connection's price/data status just became
                // Connected (transition into Connected), to avoid churn.
                bool nowConnected =
                    e.PriceStatus == ConnectionStatus.Connected ||
                    e.Status == ConnectionStatus.Connected;
                bool wasConnected =
                    e.PreviousPriceStatus == ConnectionStatus.Connected ||
                    e.PreviousStatus == ConnectionStatus.Connected;
                if (nowConnected && !wasConnected)
                {
                    log("data connection (re)connected -> re-subscribing contracts");
                    ResubscribeAll();
                }
            }
            catch (Exception ex)
            {
                log("connection status handler error: " + ex.Message);
            }
        }

        private void ResubscribeAll()
        {
            List<string> contracts;
            lock (subGate)
            {
                // Tear down stale requests so we don't leak or double-deliver.
                foreach (Sub sub in subs.Values)
                    Detach(sub);
                subs.Clear();
            }
            contracts = config.CandidateContracts;
            for (int i = 0; i < contracts.Count; i++)
                Subscribe(contracts[i]);
        }

        // Keep the /ws/nt connection alive through quiet/sparse playback gaps so
        // the backend's 15s liveness watchdog never drops us. The backend treats
        // a {"type":"heartbeat"} frame purely as liveness activity.
        private async Task HeartbeatLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(5000, token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                if (connected)
                {
                    long now = ToUnixMs(DateTime.UtcNow);
                    TryEnqueue("{\"type\":\"heartbeat\",\"time\":" +
                        now.ToString(CultureInfo.InvariantCulture) + "}");
                }
            }
        }

        // -- NinjaTrader direct Level 1 market-data subscription ---------------
        //
        // Use the same Instrument.MarketData stream that drives live charts.
        // BarsRequest can remain allocated while its private tick stream has
        // stopped delivering, which leaves the backend socket healthy but
        // silently freezes the chart platform.

        private void Subscribe(string contract)
        {
            if (string.IsNullOrEmpty(contract) || contract.Trim().Length == 0) return;
            string key = contract.Trim();
            lock (subGate)
            {
                if (subs.ContainsKey(key)) return;
                Instrument instrument;
                try
                {
                    instrument = Instrument.GetInstrument(key);
                }
                catch (Exception ex)
                {
                    log("could not resolve instrument '" + key + "': " + ex.Message);
                    return;
                }
                if (instrument == null)
                {
                    log("instrument '" + key + "' not found");
                    return;
                }

                Sub sub = new Sub(instrument);
                EventHandler<MarketDataEventArgs> handler = delegate (object s, MarketDataEventArgs e)
                {
                    OnMarketData(key, e);
                };
                sub.Handler = handler;
                try
                {
                    if (instrument.Dispatcher.HasShutdownStarted)
                    {
                        log("market data dispatcher is shutting down for " + key);
                        return;
                    }
                    instrument.Dispatcher.InvokeAsync(delegate
                    {
                        instrument.MarketData.Update += handler;
                    });
                    subs[key] = sub;
                    log("subscribed " + key + " (Level 1 stream)");
                }
                catch (Exception ex)
                {
                    Detach(sub);
                    log("market data subscribe error for " + key + ": " + ex.Message);
                }
            }
        }

        private void Unsubscribe(string contract)
        {
            if (string.IsNullOrEmpty(contract) || contract.Trim().Length == 0) return;
            string key = contract.Trim();
            lock (subGate)
            {
                Sub sub;
                if (!subs.TryGetValue(key, out sub)) return;
                Detach(sub);
                subs.Remove(key);
                log("unsubscribed " + key);
            }
        }

        private static void Detach(Sub sub)
        {
            try
            {
                if (sub.Handler != null && !sub.Instrument.Dispatcher.HasShutdownStarted)
                {
                    EventHandler<MarketDataEventArgs> handler = sub.Handler;
                    sub.Instrument.Dispatcher.InvokeAsync(delegate
                    {
                        sub.Instrument.MarketData.Update -= handler;
                    });
                }
            }
            catch
            {
                // request may already be torn down
            }
        }

        // -- normalization (runs on NinjaTrader data thread) ------------------

        private void OnMarketData(string contract, MarketDataEventArgs e)
        {
            try
            {
                if (e == null) return;
                long timeMs = ToUnixMs(e.Time.ToUniversalTime());
                Snapshot snap;
                lock (snapGate)
                {
                    if (!snapshots.TryGetValue(contract, out snap))
                    {
                        snap = new Snapshot();
                        snapshots[contract] = snap;
                    }

                    if (e.MarketDataType == MarketDataType.Last)
                    {
                        EnqueueTrade(contract, timeMs, e.Price, e.Volume, snap.Bid, snap.Ask);
                    }
                    else if (e.MarketDataType == MarketDataType.Bid)
                    {
                        snap.Bid = e.Price;
                        snap.BidSize = e.Volume;
                        EnqueueQuote(contract, timeMs, snap);
                    }
                    else if (e.MarketDataType == MarketDataType.Ask)
                    {
                        snap.Ask = e.Price;
                        snap.AskSize = e.Volume;
                        EnqueueQuote(contract, timeMs, snap);
                    }
                }
            }
            catch (Exception ex)
            {
                log("market data update error for " + contract + ": " + ex.Message);
            }
        }

        private void EnqueueTrade(string contract, long timeMs, double price, long volume, double? bid, double? ask)
        {
            lock (seqGate)
            {
                long seq = NextSeq(contract, "trade");
                StringBuilder sb = new StringBuilder(192);
                sb.Append('{');
                Str(sb, "type", "trade"); sb.Append(',');
                Str(sb, "symbol", Symbol); sb.Append(',');
                Str(sb, "contract", contract); sb.Append(',');
                Num(sb, "time", timeMs); sb.Append(',');
                Dbl(sb, "price", price); sb.Append(',');
                Num(sb, "volume", volume); sb.Append(',');
                NullableDbl(sb, "bid", bid); sb.Append(',');
                NullableDbl(sb, "ask", ask); sb.Append(',');
                NullableDbl(sb, "bestBid", bid); sb.Append(',');
                NullableDbl(sb, "bestAsk", ask); sb.Append(',');
                Num(sb, "sequence", seq);
                sb.Append('}');
                TryEnqueue(sb.ToString());
            }
        }

        private void EnqueueQuote(string contract, long timeMs, Snapshot snap)
        {
            // Need both sides for a well-formed quote; skip until both seen.
            if (snap.Bid == null || snap.Ask == null) return;
            lock (seqGate)
            {
                long seq = NextSeq(contract, "quote");
                StringBuilder sb = new StringBuilder(160);
                sb.Append('{');
                Str(sb, "type", "quote"); sb.Append(',');
                Str(sb, "symbol", Symbol); sb.Append(',');
                Str(sb, "contract", contract); sb.Append(',');
                Num(sb, "time", timeMs); sb.Append(',');
                Dbl(sb, "bid", snap.Bid.Value); sb.Append(',');
                Dbl(sb, "ask", snap.Ask.Value); sb.Append(',');
                Num(sb, "bidSize", snap.BidSize); sb.Append(',');
                Num(sb, "askSize", snap.AskSize); sb.Append(',');
                Num(sb, "sequence", seq);
                sb.Append('}');
                TryEnqueue(sb.ToString());
            }
        }

        private long NextSeq(string contract, string channel)
        {
            string key = contract + "|" + channel;
            lock (seqGate)
            {
                long current;
                if (!sequences.TryGetValue(key, out current))
                {
                    // The AddOn can be hot-reloaded while the backend keeps its
                    // per-stream high-water marks. Seed above wall-clock time
                    // so a fresh runtime never restarts at 1 and gets rejected
                    // as out-of-order by the still-running backend.
                    current = ToUnixMs(DateTime.UtcNow) * 1000;
                }
                current += 1;
                sequences[key] = current;
                return current;
            }
        }

        private void TryEnqueue(string frame)
        {
            if (!config.DropOnOverflow)
            {
                // Capture mode: backpressure playback rather than lose frames.
                // This can slow/freeze Playback if the backend is not draining.
                try
                {
                    outbound.Add(frame);
                }
                catch (InvalidOperationException)
                {
                    // shutting down
                }
                return;
            }

            // Live/default mode: non-blocking add; drop on overflow rather than
            // block the NT thread.
            if (!outbound.TryAdd(frame))
            {
                // Backpressure: discard oldest to keep the freshest tape moving.
                string discarded;
                outbound.TryTake(out discarded);
                outbound.TryAdd(frame);
                long dropped = Interlocked.Increment(ref droppedFrames);
                DateTime now = DateTime.UtcNow;
                lock (overflowLogGate)
                {
                    if ((now - lastOverflowLogUtc).TotalSeconds >= 30)
                    {
                        lastOverflowLogUtc = now;
                        log("outbound queue overflow; dropped frames=" +
                            dropped.ToString(CultureInfo.InvariantCulture) +
                            ", queued=" + outbound.Count.ToString(CultureInfo.InvariantCulture));
                    }
                }
            }
        }

        // -- sender loop (connect + reconnect + drain queue) ------------------

        private async Task SenderLoopAsync(CancellationToken token)
        {
            int attempt = 0;
            string pendingFrame = null;
            while (!token.IsCancellationRequested)
            {
                TimeSpan? reconnectDelay = null;
                try
                {
                    await EnsureConnectedAsync(token).ConfigureAwait(false);
                    attempt = 0;

                    while (!token.IsCancellationRequested)
                    {
                        if (pendingFrame == null)
                            pendingFrame = outbound.Take(token);

                        byte[] bytes = Encoding.UTF8.GetBytes(pendingFrame);
                        await socket.SendAsync(
                            new ArraySegment<byte>(bytes),
                            WebSocketMessageType.Text, true, token).ConfigureAwait(false);
                        pendingFrame = null;
                    }
                }
                catch (OperationCanceledException)
                {
                    if (token.IsCancellationRequested) return;
                }
                catch (InvalidOperationException)
                {
                    if (outbound.IsCompleted) return;
                    reconnectDelay = FibonacciDelay(attempt++);
                }
                catch (Exception ex)
                {
                    connected = false;
                    CloseQuietly();
                    reconnectDelay = FibonacciDelay(attempt++);
                    log("send/connect error: " + ex.Message + " -- reconnecting in " +
                        reconnectDelay.Value.TotalSeconds + "s");
                }

                // NinjaScript's compiler forbids 'await' inside a catch block, so
                // the backoff wait happens here, after the try/catch.
                if (reconnectDelay != null)
                {
                    try
                    {
                        await Task.Delay(reconnectDelay.Value, token).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                }
            }
        }

        private async Task EnsureConnectedAsync(CancellationToken token)
        {
            if (connected && socket != null && socket.State == WebSocketState.Open) return;
            CloseQuietly();
            socket = new ClientWebSocket();
            await socket.ConnectAsync(backendUri, token).ConfigureAwait(false);
            connected = true;
            log("connected to " + backendUri);
        }

        // -- receive loop (inbound control commands) --------------------------

        private async Task ReceiveLoopAsync(CancellationToken token)
        {
            byte[] buffer = new byte[8192];
            while (!token.IsCancellationRequested)
            {
                bool backoff = false;
                try
                {
                    if (!connected || socket == null || socket.State != WebSocketState.Open)
                    {
                        await Task.Delay(250, token).ConfigureAwait(false);
                        continue;
                    }

                    using (MemoryStream ms = new MemoryStream())
                    {
                        WebSocketReceiveResult result;
                        do
                        {
                            result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                            if (result.MessageType == WebSocketMessageType.Close)
                            {
                                connected = false;
                                break;
                            }
                            if (result.Count > 0)
                                ms.Write(buffer, 0, result.Count);
                        }
                        while (!result.EndOfMessage);

                        if (ms.Length > 0)
                            HandleControl(Encoding.UTF8.GetString(ms.ToArray()));
                    }
                }
                catch (OperationCanceledException)
                {
                    if (token.IsCancellationRequested) return;
                }
                catch (Exception)
                {
                    connected = false;
                    backoff = true;
                }

                // 'await' is not allowed in a catch block (NinjaScript C# 5),
                // so the post-error backoff wait happens here.
                if (backoff)
                {
                    try
                    {
                        await Task.Delay(250, token).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                }
            }
        }

        // Parse a flat {"type":"control","action":"subscribe","contract":"GC ..","time":..}
        private void HandleControl(string json)
        {
            try
            {
                if (json.IndexOf("\"control\"", StringComparison.Ordinal) < 0) return;
                string action = ExtractJsonString(json, "action");
                string contract = ExtractJsonString(json, "contract");
                if (string.IsNullOrEmpty(contract)) return;
                if (action == "subscribe") Subscribe(contract);
                else if (action == "unsubscribe") Unsubscribe(contract);
            }
            catch (Exception ex)
            {
                log("control parse error: " + ex.Message);
            }
        }

        private static string ExtractJsonString(string json, string key)
        {
            int i = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (i < 0) return null;
            i = json.IndexOf(':', i);
            if (i < 0) return null;
            int q1 = json.IndexOf('"', i + 1);
            if (q1 < 0) return null;
            int q2 = json.IndexOf('"', q1 + 1);
            if (q2 < 0) return null;
            return json.Substring(q1 + 1, q2 - q1 - 1);
        }

        private void CloseQuietly()
        {
            try
            {
                if (socket != null) socket.Abort();
            }
            catch { }
            try
            {
                if (socket != null) socket.Dispose();
            }
            catch { }
            socket = null;
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            try
            {
                if (cts != null) cts.Cancel();
            }
            catch { }

            try
            {
                if (connStatusHandler != null)
                    Connection.ConnectionStatusUpdate -= connStatusHandler;
            }
            catch { }

            lock (subGate)
            {
                foreach (Sub sub in subs.Values)
                    Detach(sub);
                subs.Clear();
            }

            try { outbound.CompleteAdding(); } catch { }
            CloseQuietly();
            try
            {
                if (cts != null) cts.Dispose();
            }
            catch { }
            log("stopped.");
        }

        // -- helpers ----------------------------------------------------------

        private static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        private static long ToUnixMs(DateTime utc)
        {
            return (long)(utc - Epoch).TotalMilliseconds;
        }

        private static readonly int[] Fib = new int[] { 1, 1, 2, 3, 5, 8, 13, 21, 34, 55 };
        private static readonly Random Rng = new Random();

        private static TimeSpan FibonacciDelay(int attempt)
        {
            int idx = Math.Min(attempt, Fib.Length - 1);
            double baseSec = Math.Min(Fib[idx], 60);
            double jitter = baseSec * 0.2 * (Rng.NextDouble() * 2 - 1); // +/-20%
            double sec = Math.Max(0.5, Math.Min(60, baseSec + jitter));
            return TimeSpan.FromSeconds(sec);
        }

        private static void Str(StringBuilder sb, string k, string v)
        {
            sb.Append('"').Append(k).Append("\":\"").Append(Escape(v)).Append('"');
        }

        private static void Num(StringBuilder sb, string k, long v)
        {
            sb.Append('"').Append(k).Append("\":").Append(v.ToString(CultureInfo.InvariantCulture));
        }

        private static void Dbl(StringBuilder sb, string k, double v)
        {
            sb.Append('"').Append(k).Append("\":").Append(v.ToString("R", CultureInfo.InvariantCulture));
        }

        private static void NullableDbl(StringBuilder sb, string k, double? v)
        {
            sb.Append('"').Append(k).Append("\":");
            if (v == null) sb.Append("null");
            else sb.Append(v.Value.ToString("R", CultureInfo.InvariantCulture));
        }

        private static string Escape(string s)
        {
            if (string.IsNullOrEmpty(s)) return s == null ? string.Empty : s;
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private sealed class Snapshot
        {
            public double? Bid;
            public double? Ask;
            public long BidSize;
            public long AskSize;
        }

        private sealed class Sub
        {
            public readonly Instrument Instrument;
            public EventHandler<MarketDataEventArgs> Handler;

            public Sub(Instrument instrument)
            {
                Instrument = instrument;
            }
        }
    }
}
