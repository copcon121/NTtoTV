// =============================================================================
// NTtoTV Native Diagnostics Indicator
// =============================================================================
//
// Purpose:
//   Export closed chart bars using NinjaTrader-native sources so NTtoTV can
//   decide which stream is authoritative:
//     - Chart OHLCV / Volume[0] / VOL-equivalent volume
//     - Native BuySellVolume-style OnMarketData bid/ask counters
//     - OrderFlowCumulativeDelta(BidAsk, Bar, 0), when available
//     - AddVolumetric(... BidAsk ...), when available
//
// NT compatibility:
//   Written for NinjaTrader 8.0.28 / C# 5. Avoids ?. / nameof / string
//   interpolation / out-var / expression-bodied members.
// =============================================================================

#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Xml.Serialization;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    public class NTtoTVNativeDiagnostics : Indicator
    {
        private bool exportInitialized;
        private string exportPath;
        private int lastExportedBarIdx;

        private int activeMarketDataBar;
        private BuySellCounter liveCounter;
        private Dictionary<int, BuySellCounter> buySellCounters;

        private object orderFlowBidAsk;
        private bool triedOrderFlow;
        private bool orderFlowTickSeriesRequested;

        private bool volumetricRequested;
        private bool volumetricAvailable;
        private string volumetricStatus;
        private int volumetricSeriesIndex;
        private MethodInfo getBidVolumeForPriceMethod;
        private MethodInfo getAskVolumeForPriceMethod;
        private int postSuccessCount;
        private int postFailureCount;

        [NinjaScriptProperty]
        [Display(Name = "Export Enabled", Order = 1, GroupName = "Export")]
        public bool ExportEnabled { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Export Directory", Order = 2, GroupName = "Export")]
        public string ExportDirectory { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Overwrite", Order = 3, GroupName = "Export")]
        public bool Overwrite { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Use Volumetric", Order = 4, GroupName = "Native Sources")]
        public bool UseVolumetric { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Use Order Flow Delta", Order = 5, GroupName = "Native Sources")]
        public bool UseOrderFlowDelta { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Post To Backend", Order = 1, GroupName = "Backend Bridge")]
        public bool PostToBackend { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Post Historical", Order = 2, GroupName = "Backend Bridge")]
        public bool PostHistorical { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Backend Url", Order = 3, GroupName = "Backend Bridge")]
        public string BackendUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Bridge Symbol", Order = 4, GroupName = "Backend Bridge")]
        public string BridgeSymbol { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Bridge Contract", Order = 5, GroupName = "Backend Bridge")]
        public string BridgeContract { get; set; }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Exports NT-native chart volume, bid/ask counters, OrderFlowCumulativeDelta, and Volumetric values for NTtoTV diagnostics.";
                Name = "NTtoTVNativeDiagnostics";
                Calculate = Calculate.OnEachTick;
                IsOverlay = false;
                DrawOnPricePanel = false;
                DisplayInDataBox = false;
                IsSuspendedWhileInactive = false;

                ExportEnabled = true;
                ExportDirectory = "";
                Overwrite = true;
                UseVolumetric = true;
                UseOrderFlowDelta = true;
                PostToBackend = true;
                PostHistorical = false;
                BackendUrl = "http://127.0.0.1:8000/api/nt/native-bar";
                BridgeSymbol = "GC";
                BridgeContract = "GC";

                AddPlot(System.Windows.Media.Brushes.Transparent, "NativeDiagnostics");
            }
            else if (State == State.Configure)
            {
                if (UseOrderFlowDelta)
                {
                    try
                    {
                        AddDataSeries(BarsPeriodType.Tick, 1);
                        orderFlowTickSeriesRequested = true;
                    }
                    catch (Exception ex)
                    {
                        orderFlowTickSeriesRequested = false;
                        Print("NTtoTVNativeDiagnostics AddDataSeries(1 Tick) failed: " + ex.Message);
                    }
                }

                if (UseVolumetric)
                {
                    try
                    {
                        string instrumentName = Instrument == null ? null : Instrument.FullName;
                        if (!string.IsNullOrEmpty(instrumentName) && BarsPeriod != null)
                        {
                            volumetricSeriesIndex = orderFlowTickSeriesRequested ? 2 : 1;
                            AddVolumetric(instrumentName, BarsPeriod.BarsPeriodType, BarsPeriod.Value, VolumetricDeltaType.BidAsk, 1);
                            volumetricRequested = true;
                            volumetricStatus = "requested";
                        }
                    }
                    catch (Exception ex)
                    {
                        volumetricRequested = false;
                        volumetricAvailable = false;
                        volumetricStatus = "AddVolumetric failed: " + ex.Message;
                    }
                }
            }
            else if (State == State.DataLoaded)
            {
                exportInitialized = false;
                exportPath = null;
                lastExportedBarIdx = -1;
                volumetricSeriesIndex = volumetricSeriesIndex <= 0 ? (orderFlowTickSeriesRequested ? 2 : 1) : volumetricSeriesIndex;

                activeMarketDataBar = -1;
                liveCounter = new BuySellCounter();
                buySellCounters = new Dictionary<int, BuySellCounter>();
                getBidVolumeForPriceMethod = null;
                getAskVolumeForPriceMethod = null;
                postSuccessCount = 0;
                postFailureCount = 0;

                if (UseOrderFlowDelta)
                    orderFlowBidAsk = CreateOrderFlowCumulativeDeltaBidAsk();

                if (volumetricRequested && BarsArray != null && BarsArray.Length > volumetricSeriesIndex)
                {
                    volumetricAvailable = true;
                    volumetricStatus = "available";
                }
                else if (UseVolumetric && string.IsNullOrEmpty(volumetricStatus))
                {
                    volumetricStatus = "not requested";
                }
            }
            else if (State == State.Terminated)
            {
                if (ExportEnabled && CurrentBar > 0)
                    ExportClosedBarsUpTo(CurrentBar - 1);
            }
        }

        protected override void OnMarketData(MarketDataEventArgs e)
        {
            if (e == null || e.MarketDataType != MarketDataType.Last)
                return;
            if (CurrentBar < 0)
                return;

            if (activeMarketDataBar < 0)
                activeMarketDataBar = CurrentBar;

            if (CurrentBar != activeMarketDataBar)
            {
                buySellCounters[activeMarketDataBar] = liveCounter.Clone();
                liveCounter.Reset();
                activeMarketDataBar = CurrentBar;
            }

            liveCounter.TradeEvents = liveCounter.TradeEvents + 1;
            liveCounter.Volume = liveCounter.Volume + e.Volume;
            if (e.Price >= e.Ask)
                liveCounter.BuyVolume = liveCounter.BuyVolume + e.Volume;
            else if (e.Price <= e.Bid)
                liveCounter.SellVolume = liveCounter.SellVolume + e.Volume;
            else
                liveCounter.UnknownVolume = liveCounter.UnknownVolume + e.Volume;
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0)
                return;
            if (CurrentBar < 1)
                return;

            Values[0][0] = 0;

            if (activeMarketDataBar >= 0 && CurrentBar != activeMarketDataBar)
            {
                buySellCounters[activeMarketDataBar] = liveCounter.Clone();
                liveCounter.Reset();
                activeMarketDataBar = CurrentBar;
            }

            if (ExportEnabled)
                ExportClosedBarsUpTo(CurrentBar - 1);
        }

        private void ExportClosedBarsUpTo(int targetBarIdx)
        {
            if (targetBarIdx <= lastExportedBarIdx)
                return;

            int barIdx;
            for (barIdx = lastExportedBarIdx + 1; barIdx <= targetBarIdx; barIdx++)
                ExportBar(barIdx);
        }

        private void ExportBar(int barIdx)
        {
            if (Bars == null || barIdx < 0 || barIdx >= Bars.Count)
                return;

            try
            {
                EnsureExportFile();

                int barsAgo = CurrentBar - barIdx;
                if (barsAgo < 0)
                    barsAgo = 0;

                DateTime barTime = Time.GetValueAt(barIdx);
                DateTime utcTime = ToUtc(barTime);
                long utcMs = ToUnixMs(utcTime);
                DateTime bucketTime = GetBucketTime(barTime);
                DateTime bucketUtcTime = ToUtc(bucketTime);
                long bucketUtcMs = ToUnixMs(bucketUtcTime);

                BuySellCounter bs = null;
                if (buySellCounters != null)
                    buySellCounters.TryGetValue(barIdx, out bs);

                string ofStatus = "";
                string ofOpen = "";
                string ofHigh = "";
                string ofLow = "";
                string ofClose = "";
                if (UseOrderFlowDelta)
                {
                    EnsureOrderFlow();
                    if (orderFlowBidAsk == null)
                    {
                        ofStatus = "unavailable";
                    }
                    else
                    {
                        ofStatus = "ok";
                        ofOpen = GetSeriesValueText(orderFlowBidAsk, "DeltaOpen", barsAgo);
                        ofHigh = GetSeriesValueText(orderFlowBidAsk, "DeltaHigh", barsAgo);
                        ofLow = GetSeriesValueText(orderFlowBidAsk, "DeltaLow", barsAgo);
                        ofClose = GetSeriesValueText(orderFlowBidAsk, "DeltaClose", barsAgo);
                    }
                }

                VolumetricSnapshot vol = GetVolumetricSnapshot(barIdx);

                string instrumentName = Instrument == null ? "" : Instrument.FullName;
                string barsPeriodText = BarsPeriod == null ? "" : BarsPeriod.ToString();
                double barVolume = Volume.GetValueAt(barIdx);

                string line = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14},{15},{16},{17},{18},{19},{20},{21},{22},{23},{24},{25},{26},{27},{28},{29},{30},{31},{32},{33},{34},{35}",
                    Csv(instrumentName),
                    Csv(barsPeriodText),
                    barIdx,
                    Csv(barTime.ToString("yyyy-MM-dd HH:mm:ss.fffffff", CultureInfo.InvariantCulture)),
                    Csv(utcTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture)),
                    utcMs,
                    Csv(bucketTime.ToString("yyyy-MM-dd HH:mm:ss.fffffff", CultureInfo.InvariantCulture)),
                    Csv(bucketUtcTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture)),
                    bucketUtcMs,
                    Open.GetValueAt(barIdx),
                    High.GetValueAt(barIdx),
                    Low.GetValueAt(barIdx),
                    Close.GetValueAt(barIdx),
                    barVolume,
                    barVolume,
                    bs == null ? "" : bs.TradeEvents.ToString(CultureInfo.InvariantCulture),
                    bs == null ? "" : bs.Volume.ToString(CultureInfo.InvariantCulture),
                    bs == null ? "" : bs.BuyVolume.ToString(CultureInfo.InvariantCulture),
                    bs == null ? "" : bs.SellVolume.ToString(CultureInfo.InvariantCulture),
                    bs == null ? "" : bs.UnknownVolume.ToString(CultureInfo.InvariantCulture),
                    bs == null ? "" : (bs.BuyVolume - bs.SellVolume).ToString(CultureInfo.InvariantCulture),
                    Csv(ofStatus),
                    ofOpen,
                    ofHigh,
                    ofLow,
                    ofClose,
                    Csv(vol.Status),
                    vol.TotalVolume,
                    vol.TotalBuyingVolume,
                    vol.TotalSellingVolume,
                    vol.BarDelta,
                    vol.Trades,
                    vol.MinSeenDelta,
                    vol.MaxSeenDelta,
                    Csv(vol.TypeName),
                    barTime.Ticks);

                File.AppendAllText(exportPath, line + Environment.NewLine);

                if (ShouldPostBar())
                {
                    PostNativeBar(
                        instrumentName,
                        bucketUtcMs,
                        Open.GetValueAt(barIdx),
                        High.GetValueAt(barIdx),
                        Low.GetValueAt(barIdx),
                        Close.GetValueAt(barIdx),
                        barVolume,
                        vol,
                        bs);
                }

                lastExportedBarIdx = barIdx;
            }
            catch (Exception ex)
            {
                Print("NTtoTVNativeDiagnostics export failed: " + ex.Message);
            }
        }

        private bool ShouldPostBar()
        {
            if (!PostToBackend)
                return false;
            if (string.IsNullOrEmpty(BackendUrl))
                return false;
            if (BarsPeriod == null || BarsPeriod.BarsPeriodType != BarsPeriodType.Minute || BarsPeriod.Value != 1)
                return false;
            if (!PostHistorical && State != State.Realtime)
                return false;
            return true;
        }

        private void PostNativeBar(
            string sourceContract,
            long bucketUtcMs,
            double open,
            double high,
            double low,
            double close,
            double chartVolume,
            VolumetricSnapshot vol,
            BuySellCounter bs)
        {
            try
            {
                bool hasVolumetric = vol != null && vol.Status == "ok";
                bool hasBuySell = bs != null && bs.Volume > 0;
                if (!hasVolumetric && !hasBuySell)
                    return;

                string payload = BuildNativeBarJson(
                    sourceContract,
                    bucketUtcMs,
                    open,
                    high,
                    low,
                    close,
                    chartVolume,
                    vol,
                    bs);
                string url = BackendUrl;
                bool firstPost = postSuccessCount == 0 && postFailureCount == 0;
                string source = hasVolumetric ? "volumetric" : "buySellCounter";
                if (firstPost)
                    Print("NTtoTVNativeDiagnostics posting first native bar (source=" + source + ") to " + url);
                ThreadPool.QueueUserWorkItem(delegate(object state)
                {
                    PostJson(url, payload);
                });
            }
            catch (Exception ex)
            {
                postFailureCount = postFailureCount + 1;
                if (postFailureCount <= 5)
                    Print("NTtoTVNativeDiagnostics native post build failed: " + ex.Message);
            }
        }

        private string BuildNativeBarJson(
            string sourceContract,
            long bucketUtcMs,
            double open,
            double high,
            double low,
            double close,
            double chartVolume,
            VolumetricSnapshot vol,
            BuySellCounter bs)
        {
            bool hasVolumetric = vol != null && vol.Status == "ok";
            long volume;
            long buyVolume;
            long sellVolume;
            long delta;
            long deltaHigh;
            long deltaLow;

            if (hasVolumetric)
            {
                volume = ToLong(vol.TotalVolume, (long)Math.Round(chartVolume));
                buyVolume = ToLong(vol.TotalBuyingVolume, 0);
                sellVolume = ToLong(vol.TotalSellingVolume, 0);
                delta = ToLong(vol.BarDelta, buyVolume - sellVolume);
                deltaHigh = ToLong(vol.MaxSeenDelta, Math.Max(delta, 0));
                deltaLow = ToLong(vol.MinSeenDelta, Math.Min(delta, 0));
            }
            else if (bs != null)
            {
                volume = (long)Math.Round(chartVolume);
                buyVolume = bs.BuyVolume;
                sellVolume = bs.SellVolume;
                delta = buyVolume - sellVolume;
                deltaHigh = Math.Max(delta, 0);
                deltaLow = Math.Min(delta, 0);
            }
            else
            {
                volume = (long)Math.Round(chartVolume);
                buyVolume = 0;
                sellVolume = 0;
                delta = 0;
                deltaHigh = 0;
                deltaLow = 0;
            }

            string symbol = string.IsNullOrEmpty(BridgeSymbol) ? "GC" : BridgeSymbol;
            string contract = string.IsNullOrEmpty(BridgeContract) ? symbol : BridgeContract;

            StringBuilder sb = new StringBuilder(4096);
            sb.Append("{");
            AppendJsonString(sb, "symbol", symbol, true);
            AppendJsonString(sb, "contract", contract, true);
            AppendJsonString(sb, "sourceContract", sourceContract, true);
            AppendJsonString(sb, "tf", "1m", true);
            AppendJsonNumber(sb, "time", bucketUtcMs, true);
            AppendJsonNumber(sb, "open", open, true);
            AppendJsonNumber(sb, "high", high, true);
            AppendJsonNumber(sb, "low", low, true);
            AppendJsonNumber(sb, "close", close, true);
            AppendJsonNumber(sb, "volume", volume, true);
            AppendJsonNumber(sb, "buyVolume", buyVolume, true);
            AppendJsonNumber(sb, "sellVolume", sellVolume, true);
            AppendJsonNumber(sb, "delta", delta, true);
            AppendJsonNumber(sb, "deltaHigh", deltaHigh, true);
            AppendJsonNumber(sb, "deltaLow", deltaLow, true);
            AppendJsonNumber(sb, "openDelta", 0, true);
            AppendJsonNumber(sb, "closeDelta", delta, true);
            sb.Append("\"rows\":[");
            if (hasVolumetric && vol.Rows != null)
            {
                int i;
                bool first = true;
                for (i = 0; i < vol.Rows.Count; i++)
                {
                    VolumetricRow row = vol.Rows[i];
                    if (row == null || (row.Bid <= 0 && row.Ask <= 0))
                        continue;
                    if (!first)
                        sb.Append(",");
                    sb.Append("{");
                    AppendJsonNumber(sb, "price", row.Price, true);
                    AppendJsonNumber(sb, "bid", row.Bid, true);
                    AppendJsonNumber(sb, "ask", row.Ask, false);
                    sb.Append("}");
                    first = false;
                }
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private void PostJson(string url, string payload)
        {
            try
            {
                byte[] body = Encoding.UTF8.GetBytes(payload);
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.ContentLength = body.Length;
                request.Timeout = 3000;
                request.ReadWriteTimeout = 3000;
                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(body, 0, body.Length);
                }
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    int status = (int)response.StatusCode;
                    if (status >= 200 && status < 300)
                    {
                        postSuccessCount = postSuccessCount + 1;
                    }
                    else
                    {
                        postFailureCount = postFailureCount + 1;
                        if (postFailureCount <= 5)
                            Print("NTtoTVNativeDiagnostics native post returned HTTP " + status.ToString(CultureInfo.InvariantCulture));
                    }
                }
            }
            catch (Exception ex)
            {
                postFailureCount = postFailureCount + 1;
                if (postFailureCount <= 5 || postFailureCount % 50 == 0)
                    Print("NTtoTVNativeDiagnostics native post failed: " + ex.Message);
            }
        }

        private static void AppendJsonString(StringBuilder sb, string name, string value, bool comma)
        {
            sb.Append("\"");
            sb.Append(JsonEscape(name));
            sb.Append("\":\"");
            sb.Append(JsonEscape(value));
            sb.Append("\"");
            if (comma)
                sb.Append(",");
        }

        private static void AppendJsonNumber(StringBuilder sb, string name, double value, bool comma)
        {
            sb.Append("\"");
            sb.Append(JsonEscape(name));
            sb.Append("\":");
            sb.Append(value.ToString("0.##########", CultureInfo.InvariantCulture));
            if (comma)
                sb.Append(",");
        }

        private static void AppendJsonNumber(StringBuilder sb, string name, long value, bool comma)
        {
            sb.Append("\"");
            sb.Append(JsonEscape(name));
            sb.Append("\":");
            sb.Append(value.ToString(CultureInfo.InvariantCulture));
            if (comma)
                sb.Append(",");
        }

        private static string JsonEscape(string value)
        {
            if (value == null)
                return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private static long ToLong(string value, long fallback)
        {
            if (string.IsNullOrEmpty(value))
                return fallback;
            long parsed;
            if (long.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out parsed))
                return parsed;
            double parsedDouble;
            if (double.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out parsedDouble))
                return (long)Math.Round(parsedDouble);
            return fallback;
        }

        private object CreateOrderFlowCumulativeDeltaBidAsk()
        {
            triedOrderFlow = true;
            try
            {
                MethodInfo selected = null;
                MethodInfo[] methods = typeof(NinjaTrader.NinjaScript.Indicators.Indicator).GetMethods();
                int i;
                for (i = 0; i < methods.Length; i++)
                {
                    MethodInfo method = methods[i];
                    if (method.Name != "OrderFlowCumulativeDelta")
                        continue;
                    ParameterInfo[] parameters = method.GetParameters();
                    if (parameters.Length == 3)
                    {
                        selected = method;
                        break;
                    }
                }
                if (selected == null)
                    return null;

                ParameterInfo[] p = selected.GetParameters();
                object deltaType = Enum.Parse(p[0].ParameterType, "BidAsk");
                object period = Enum.Parse(p[1].ParameterType, "Bar");
                return selected.Invoke(this, new object[] { deltaType, period, 0 });
            }
            catch (Exception ex)
            {
                Print("NTtoTVNativeDiagnostics OrderFlowCumulativeDelta unavailable: " + ex.Message);
                return null;
            }
        }

        private void EnsureOrderFlow()
        {
            if (!UseOrderFlowDelta)
                return;
            if (triedOrderFlow && orderFlowBidAsk != null)
                return;
            if (!triedOrderFlow)
                orderFlowBidAsk = CreateOrderFlowCumulativeDeltaBidAsk();
        }

        private VolumetricSnapshot GetVolumetricSnapshot(int barIdx)
        {
            VolumetricSnapshot result = new VolumetricSnapshot();
            result.Status = volumetricStatus;

            if (!UseVolumetric)
            {
                result.Status = "disabled";
                return result;
            }
            if (!volumetricAvailable || BarsArray == null || BarsArray.Length <= volumetricSeriesIndex)
            {
                if (string.IsNullOrEmpty(result.Status))
                    result.Status = "unavailable";
                return result;
            }
            if (barIdx < 0 || BarsArray[volumetricSeriesIndex] == null || barIdx >= BarsArray[volumetricSeriesIndex].Count)
            {
                result.Status = "not-ready";
                return result;
            }

            try
            {
                object barsType = BarsArray[volumetricSeriesIndex].BarsType;
                if (barsType == null)
                {
                    result.Status = "bars-type-null";
                    return result;
                }
                result.TypeName = barsType.GetType().FullName;

                object volumes = GetPropertyValue(barsType, "Volumes", null);
                if (volumes == null)
                {
                    result.Status = "no-volumes";
                    return result;
                }

                object volumeBar = GetIndexedValue(volumes, barIdx);
                if (volumeBar == null)
                {
                    result.Status = "no-volume-bar";
                    return result;
                }

                result.TotalVolume = GetMemberText(volumeBar, "TotalVolume");
                result.TotalBuyingVolume = GetMemberText(volumeBar, "TotalBuyingVolume");
                result.TotalSellingVolume = GetMemberText(volumeBar, "TotalSellingVolume");
                result.BarDelta = GetMemberText(volumeBar, "BarDelta");
                result.Trades = GetMemberText(volumeBar, "Trades");
                result.MinSeenDelta = GetMemberText(volumeBar, "MinSeenDelta");
                result.MaxSeenDelta = GetMemberText(volumeBar, "MaxSeenDelta");
                result.Rows = GetVolumetricRows(volumeBar, barIdx);
                result.Status = "ok";
            }
            catch (Exception ex)
            {
                result.Status = "error: " + ex.Message;
            }

            return result;
        }

        private List<VolumetricRow> GetVolumetricRows(object volumeBar, int barIdx)
        {
            List<VolumetricRow> rows = new List<VolumetricRow>();
            if (volumeBar == null)
                return rows;

            EnsureVolumetricRowMethods(volumeBar);
            if (getBidVolumeForPriceMethod == null || getAskVolumeForPriceMethod == null)
                return rows;

            double tickSize = GetInstrumentTickSize();
            double low = Low.GetValueAt(barIdx);
            double high = High.GetValueAt(barIdx);
            int lowTick = (int)Math.Round(low / tickSize);
            int highTick = (int)Math.Round(high / tickSize);
            int tick;
            for (tick = highTick; tick >= lowTick; tick--)
            {
                double price = Math.Round(tick * tickSize, 10);
                long bid = InvokeVolumeForPrice(volumeBar, getBidVolumeForPriceMethod, price);
                long ask = InvokeVolumeForPrice(volumeBar, getAskVolumeForPriceMethod, price);
                if (bid <= 0 && ask <= 0)
                    continue;
                VolumetricRow row = new VolumetricRow();
                row.Price = price;
                row.Bid = bid;
                row.Ask = ask;
                rows.Add(row);
            }
            return rows;
        }

        private void EnsureVolumetricRowMethods(object volumeBar)
        {
            if (getBidVolumeForPriceMethod != null && getAskVolumeForPriceMethod != null)
                return;
            MethodInfo[] methods = volumeBar.GetType().GetMethods();
            int i;
            for (i = 0; i < methods.Length; i++)
            {
                MethodInfo method = methods[i];
                ParameterInfo[] parameters = method.GetParameters();
                if (parameters.Length != 1)
                    continue;
                if (method.Name == "GetBidVolumeForPrice")
                    getBidVolumeForPriceMethod = method;
                else if (method.Name == "GetAskVolumeForPrice")
                    getAskVolumeForPriceMethod = method;
            }
            if (getBidVolumeForPriceMethod == null || getAskVolumeForPriceMethod == null)
                Print("NTtoTVNativeDiagnostics could not find Volumetric GetBidVolumeForPrice/GetAskVolumeForPrice methods.");
        }

        private long InvokeVolumeForPrice(object volumeBar, MethodInfo method, double price)
        {
            try
            {
                object value = method.Invoke(volumeBar, new object[] { price });
                if (value == null)
                    return 0;
                return Convert.ToInt64(value, CultureInfo.InvariantCulture);
            }
            catch
            {
                return 0;
            }
        }

        private double GetInstrumentTickSize()
        {
            try
            {
                if (Instrument != null && Instrument.MasterInstrument != null && Instrument.MasterInstrument.TickSize > 0)
                    return Instrument.MasterInstrument.TickSize;
            }
            catch
            {
            }
            return 0.1;
        }

        private static object GetIndexedValue(object collection, int index)
        {
            if (collection == null)
                return null;

            Array arr = collection as Array;
            if (arr != null)
            {
                if (index >= 0 && index < arr.Length)
                    return arr.GetValue(index);
                return null;
            }

            PropertyInfo item = collection.GetType().GetProperty("Item");
            if (item != null)
                return item.GetValue(collection, new object[] { index });

            MethodInfo getItem = collection.GetType().GetMethod("get_Item");
            if (getItem != null)
                return getItem.Invoke(collection, new object[] { index });

            return null;
        }

        private static object GetPropertyValue(object target, string propertyName, object[] index)
        {
            if (target == null || string.IsNullOrEmpty(propertyName))
                return null;
            PropertyInfo prop = target.GetType().GetProperty(propertyName);
            if (prop == null)
                return null;
            return prop.GetValue(target, index);
        }

        private static string GetMemberText(object target, string memberName)
        {
            if (target == null)
                return "";
            try
            {
                object value = GetPropertyValue(target, memberName, null);
                if (value == null)
                {
                    FieldInfo field = target.GetType().GetField(memberName);
                    if (field != null)
                        value = field.GetValue(target);
                }
                if (value == null)
                    return "";
                IFormattable formattable = value as IFormattable;
                if (formattable != null)
                    return formattable.ToString(null, CultureInfo.InvariantCulture);
                return value.ToString();
            }
            catch
            {
                return "";
            }
        }

        private static string GetSeriesValueText(object indicator, string seriesProperty, int barsAgo)
        {
            try
            {
                object series = GetPropertyValue(indicator, seriesProperty, null);
                if (series == null)
                    return "";

                PropertyInfo countProp = series.GetType().GetProperty("Count");
                if (countProp != null)
                {
                    int count = Convert.ToInt32(countProp.GetValue(series, null), CultureInfo.InvariantCulture);
                    if (barsAgo < 0 || barsAgo >= count)
                        return "";
                }

                object value = GetIndexedValue(series, barsAgo);
                if (value == null)
                    return "";
                IFormattable formattable = value as IFormattable;
                if (formattable != null)
                    return formattable.ToString(null, CultureInfo.InvariantCulture);
                return value.ToString();
            }
            catch
            {
                return "";
            }
        }

        private void EnsureExportFile()
        {
            if (exportInitialized)
                return;

            string dir = ExportDirectory;
            if (string.IsNullOrEmpty(dir))
                dir = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, "debug-exports");
            if (!Path.IsPathRooted(dir))
                dir = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, dir);
            Directory.CreateDirectory(dir);

            string instrumentName = Instrument == null ? "Instrument" : Instrument.FullName;
            string barsPeriodText = BarsPeriod == null ? "Bars" : BarsPeriod.ToString();
            string fileName = "NTtoTVNativeDiagnostics_" + SanitizeFileName(instrumentName) + "_" + SanitizeFileName(barsPeriodText) + ".csv";
            exportPath = Path.Combine(dir, fileName);

            if (Overwrite && File.Exists(exportPath))
                File.Delete(exportPath);

            if (!File.Exists(exportPath) || new FileInfo(exportPath).Length == 0)
            {
                File.AppendAllText(
                    exportPath,
                    "instrument,barsPeriod,barIndex,timeLocal,timeUtc,utcMs,bucketLocal,bucketUtc,bucketUtcMs,open,high,low,close,chartVolume,volIndicatorVolume,bsvTradeEvents,bsvVolume,bsvBuyVolume,bsvSellVolume,bsvUnknownVolume,bsvDelta,orderFlowStatus,ofDeltaOpen,ofDeltaHigh,ofDeltaLow,ofDeltaClose,volumetricStatus,volTotalVolume,volTotalBuyingVolume,volTotalSellingVolume,volBarDelta,volTrades,volMinSeenDelta,volMaxSeenDelta,volumetricType,timeTicks" + Environment.NewLine);
            }

            exportInitialized = true;
            Print("NTtoTVNativeDiagnostics export path: " + exportPath);
        }

        private DateTime GetBucketTime(DateTime barTime)
        {
            if (BarsPeriod == null)
                return barTime;

            switch (BarsPeriod.BarsPeriodType)
            {
                case BarsPeriodType.Second:
                    return barTime.AddSeconds(-BarsPeriod.Value);
                case BarsPeriodType.Minute:
                    return barTime.AddMinutes(-BarsPeriod.Value);
                case BarsPeriodType.Day:
                    return barTime.AddDays(-BarsPeriod.Value);
                case BarsPeriodType.Week:
                    return barTime.AddDays(-7 * BarsPeriod.Value);
                case BarsPeriodType.Month:
                    return barTime.AddMonths(-BarsPeriod.Value);
                default:
                    return barTime;
            }
        }

        private static DateTime ToUtc(DateTime value)
        {
            if (value.Kind == DateTimeKind.Utc)
                return value;
            if (value.Kind == DateTimeKind.Local)
                return value.ToUniversalTime();
            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Local));
        }

        private static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        private static long ToUnixMs(DateTime utc)
        {
            return (long)(utc - Epoch).TotalMilliseconds;
        }

        private static string Csv(string value)
        {
            if (value == null)
                value = "";
            if (value.IndexOf(',') >= 0 || value.IndexOf('"') >= 0 || value.IndexOf('\n') >= 0 || value.IndexOf('\r') >= 0)
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            return value;
        }

        private static string SanitizeFileName(string value)
        {
            if (string.IsNullOrEmpty(value))
                return "blank";
            char[] invalid = Path.GetInvalidFileNameChars();
            char[] chars = value.ToCharArray();
            int i;
            for (i = 0; i < chars.Length; i++)
            {
                int j;
                for (j = 0; j < invalid.Length; j++)
                {
                    if (chars[i] == invalid[j])
                    {
                        chars[i] = '_';
                        break;
                    }
                }
                if (char.IsWhiteSpace(chars[i]))
                    chars[i] = '_';
            }
            return new string(chars);
        }

        private sealed class BuySellCounter
        {
            public long TradeEvents;
            public long Volume;
            public long BuyVolume;
            public long SellVolume;
            public long UnknownVolume;

            public void Reset()
            {
                TradeEvents = 0;
                Volume = 0;
                BuyVolume = 0;
                SellVolume = 0;
                UnknownVolume = 0;
            }

            public BuySellCounter Clone()
            {
                BuySellCounter copy = new BuySellCounter();
                copy.TradeEvents = TradeEvents;
                copy.Volume = Volume;
                copy.BuyVolume = BuyVolume;
                copy.SellVolume = SellVolume;
                copy.UnknownVolume = UnknownVolume;
                return copy;
            }
        }

        private sealed class VolumetricSnapshot
        {
            public string Status = "";
            public string TypeName = "";
            public string TotalVolume = "";
            public string TotalBuyingVolume = "";
            public string TotalSellingVolume = "";
            public string BarDelta = "";
            public string Trades = "";
            public string MinSeenDelta = "";
            public string MaxSeenDelta = "";
            public List<VolumetricRow> Rows = new List<VolumetricRow>();
        }

        private sealed class VolumetricRow
        {
            public double Price;
            public long Bid;
            public long Ask;
        }
    }
}
