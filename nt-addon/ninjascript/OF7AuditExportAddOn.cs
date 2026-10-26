// Read-only one-shot audit of an ALREADY attached OrderFlowsTrader indicator.
// Deploy this source to NinjaTrader Custom/AddOns and compile. Existing charts
// are inspected on Configure/Active; newly opened charts are inspected Loaded.
// The actual copy is scheduled with TriggerCustomEvent on the indicator thread.
// No indicators are created, no settings are changed, no feeds are connected,
// and no strategy, account, order, licence, cookie or credential APIs are read.
// Only explicit calculation settings, BarData, and _allSeries are exported.
// Output: %TEMP%/nttotv-of7-audit-<UTC>-<random>.json, at most 300 closed bars.
// Loading charts are retried every three seconds for at most 40 scan attempts.
// The timer stops on the first successful export, termination, or attempt limit.
// This does not certify untriggered detectors: only enabled series can be
// compared, and chart historical processing may differ from realtime indexing.
// Remove this AddOn source and compile after the audit if no longer needed.
// C# 5 syntax is retained for the NinjaScript compiler.

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using NinjaTrader.Gui.Chart;
using NinjaTrader.NinjaScript;

namespace NinjaTrader.NinjaScript.AddOns
{
    public class OF7AuditExportAddOn : AddOnBase
    {
        private const int MaximumClosedBars = 300;
        private readonly HashSet<object> scheduled = new HashSet<object>();
        private readonly object gate = new object();
        private static readonly object StatusGate = new object();
        private static readonly List<string> StatusLines = new List<string>();
        private bool terminated;
        private volatile bool exportComplete;
        private DispatcherTimer retryTimer;
        private int retryAttempts;
        private const int MaximumAttempts = 40;

        // Strict allowlist: never enumerate arbitrary properties, particularly
        // vendor licence/identity strings. Zone size is numeric display context.
        private static readonly string[] Settings = (
            "GlobalLookBackPeriod ImbalanceInPercent MinimalImbalanceVolume ImbalanceClusterSize " +
            "ExtremeImbalanceThreshold ValueAreaInPercent RatioBoundsLow RatioBoundsHigh " +
            "ContractSize TicksAggregated UpDownTickMode FastHistoricalDataProcessing " +
            "EnableAccumulationDistribution AccumulationDistributionPassiveTradersInControl AccumulationDistributionUseLookBack " +
            "EnableTails TailsCheckEva TailsCheckHhLl TailsUseLookBack " +
            "EnableDeltaDivergence DeltaDivergenceOnlyDailyHighLow DeltaDivergenceUseLookBack " +
            "EnableExhaustionPrints ExhaustionPrintsUseLookBack ExhaustionPrintsSizeLimit " +
            "EnableImbalanceReversal ImbalanceReversalUseLookBack ImbalanceReversalMinimalVolume " +
            "EnableMarketSweep MarketSweepUseLookBack MarketSweepClusterSize MarketSweepVolumeThreshold " +
            "EnableMarketWeakness MarketWeaknessUseLookBack MarketWeaknessSequenceLength " +
            "EnableOrderflowsSequencing OrderflowsSequencingUseLookBack OrderflowsSequencingClusterSize " +
            "EnablePocSlingshot PocSlingshotUseLookBack " +
            "EnableProminentPocLevel1 ProminentPocLevel1LookBackBars ProminentPocLevel1POCDistance ProminentPocLevel1CheckDelta " +
            "EnableProminentPocLevel2 ProminentPocLevel2LookBackBars ProminentPocLevel2POCDistance ProminentPocLevel2CheckDelta " +
            "EnableProminentPocLevel3 ProminentPocLevel3LookBackBars ProminentPocLevel3POCDistance ProminentPocLevel3CheckDelta " +
            "EnableValueArea EnableEngulfingValueArea EnableZeroPrint ZeroPrintUseLookBack " +
            "EnableThinPrints ThinPrintsUseLookBack ThinPrintsMaximumVolume MultipleThinPrintsThreshold " +
            "EnableStackedImbalance StackedImbalanceUseLookBack " +
            "EnableInverseVolumeImbalance InverseVolumeImbalanceUseLookBack InverseVolumeImbalanceClusterSize " +
            "EnableOrderflowsRatio OrderflowsRatioUseLookBack OrderflowsRatioZoneSize " +
            "EnableMultipleImbalances MultipleImbalancesUseLookBack " +
            "EnableOpenPOC OpenPOCLookBackBars EnableAlignedPOC EnableOrderflowsGaps OrderflowsGapsUseLookBack " +
            "EnableImbalanceReload EnableVolumeDecline VolumeDeclineUseLookBack EnablePOCWave POCWaveUseLookBack " +
            "EnableDeltaTail DeltaTailUseLookBack EnableDeltaBreakout DeltaBreakoutThreshold DeltaBreakoutUseLookBack " +
            "EnableRetailSuck RetailSuckUseLookBack EnableRestingLiquidity RestingLiquidityThreshold RestingLiquidityUseLookBack " +
            "EnableVerticalLiquidity VerticalLiquidityThreshold VerticalLiquidityClusterSize VerticalLiquidityUseLookBack " +
            "EnablePriceActionDivergence PriceActionDivergenceOnlyDailyHighLow PriceActionDivergenceUseLookBack " +
            "DetectUnfinishedBusiness UnfinishedBusinessUseLookBack"
        ).Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

        protected override void OnStateChange()
        {
            Status("lifecycle=" + State.ToString());
            if (State == State.SetDefaults)
            {
                Name = "OF7 Read-only Audit Export";
                Description = "Exports existing OF7 numeric state once for local parity checks.";
            }
            else if (State == State.Configure || State == State.Active)
            {
                terminated = false;
                NinjaTrader.Core.Globals.MainThreadDispatcher.BeginInvoke(new Action(delegate
                {
                    if (terminated || exportComplete || retryTimer != null) return;
                    retryTimer = new DispatcherTimer(DispatcherPriority.Background, NinjaTrader.Core.Globals.MainThreadDispatcher);
                    retryTimer.Interval = TimeSpan.FromSeconds(3);
                    retryTimer.Tick += RetryScan;
                    retryTimer.Start();
                    ScanExistingWindows();
                }));
            }
            else if (State == State.Terminated)
            {
                terminated = true;
                StopRetries();
            }
        }

        private void RetryScan(object sender, EventArgs args)
        {
            ScanExistingWindows();
        }

        private void ScanExistingWindows()
        {
            if (terminated || exportComplete || retryAttempts >= MaximumAttempts)
            {
                StopRetries();
                return;
            }
            retryAttempts++;
            Status("scan_attempt=" + retryAttempts.ToString(CultureInfo.InvariantCulture));
            try
            {
                Window[] windows;
                lock (NinjaTrader.Core.Globals.AllWindows)
                {
                    windows = new List<Window>(NinjaTrader.Core.Globals.AllWindows).ToArray();
                }
                Status("window_count=" + windows.Length.ToString(CultureInfo.InvariantCulture));
                foreach (Window window in windows) ScheduleChart(window);
            }
            catch (Exception ex) { Status("window_scan_error=" + RootException(ex).GetType().FullName); }
            if (retryAttempts >= MaximumAttempts)
            {
                Status("scan_attempt_limit_reached");
                StopRetries();
            }
        }

        private void StopRetries()
        {
            Action stop = delegate
            {
                if (retryTimer == null) return;
                retryTimer.Stop();
                retryTimer.Tick -= RetryScan;
                // Retain the stopped instance: a later Active callback must not
                // restart a Configure scan that already reached its bound.
            };
            if (NinjaTrader.Core.Globals.MainThreadDispatcher.CheckAccess()) stop();
            else NinjaTrader.Core.Globals.MainThreadDispatcher.BeginInvoke(stop);
        }

        protected override void OnWindowCreated(Window window)
        {
            Status("window_created_type=" + window.GetType().FullName);
            if (!(window is Chart)) return;
            window.Loaded += delegate { ScheduleChart(window); };
            if (window.IsLoaded) ScheduleChart(window);
        }

        private void ScheduleChart(Window window)
        {
            Chart chart = window as Chart;
            if (chart == null || terminated || exportComplete) return;
            chart.Dispatcher.BeginInvoke(new Action(delegate
            {
                if (terminated || exportComplete) return;
                try
                {
                List<ChartControl> controls = new List<ChartControl>();
                if (chart.ActiveChartControl != null) controls.Add(chart.ActiveChartControl);
                FindChartControls(chart, controls, 0);
                Status("chart_control_count=" + controls.Count.ToString(CultureInfo.InvariantCulture));
                foreach (ChartControl control in controls)
                {
                    int indicatorCount = 0;
                    foreach (object candidate in control.Indicators)
                    {
                        indicatorCount++;
                        Status("indicator_type=" + (candidate == null ? "null" : candidate.GetType().FullName));
                        if (candidate == null || candidate.GetType().FullName != "NinjaTrader.NinjaScript.Indicators.OrderFlowsTrader")
                            continue;
                        NinjaScriptBase script = candidate as NinjaScriptBase;
                        if (script == null) continue;
                        lock (gate)
                        {
                            if (!scheduled.Add(candidate)) continue;
                        }
                        object target = candidate;
                        Status("custom_event_scheduled");
                        script.TriggerCustomEvent(new Action<object>(delegate(object unused)
                        {
                            Status("custom_event_running");
                            if (!terminated && !exportComplete) Export(target);
                        }), null);
                    }
                    Status("indicator_count=" + indicatorCount.ToString(CultureInfo.InvariantCulture));
                }
                }
                catch (Exception ex) { Status("chart_scan_error=" + RootException(ex).GetType().FullName); }
            }));
        }

        private static void FindChartControls(DependencyObject item, List<ChartControl> result, int depth)
        {
            if (item == null || depth > 35) return;
            ChartControl found = item as ChartControl;
            if (found != null)
            {
                if (!result.Contains(found)) result.Add(found);
                return;
            }
            int count;
            try { count = VisualTreeHelper.GetChildrenCount(item); }
            catch { return; }
            for (int i = 0; i < count; i++) FindChartControls(VisualTreeHelper.GetChild(item, i), result, depth + 1);
        }

        private void Export(object indicator)
        {
            try
            {
                object processor = ReadField(indicator, "_processor");
                object orderflow = ReadProperty(processor, "BarOrderflowData");
                IDictionary allSeries = ReadField(indicator, "_allSeries") as IDictionary;
                int current = Convert.ToInt32(ReadProperty(indicator, "CurrentBar"), CultureInfo.InvariantCulture);
                Status("source_current_bar=" + current.ToString(CultureInfo.InvariantCulture)
                    + ";orderflow_present=" + (orderflow != null).ToString()
                    + ";series_present=" + (allSeries != null).ToString());
                Status("source_state=" + Convert.ToString(ReadProperty(indicator, "State"), CultureInfo.InvariantCulture)
                    + ";bars_count=" + Convert.ToString(ReadProperty(ReadProperty(indicator, "Bars"), "Count"), CultureInfo.InvariantCulture)
                    + ";orderflow_count=" + Convert.ToString(ReadProperty(orderflow, "Count"), CultureInfo.InvariantCulture));
                if (orderflow == null || allSeries == null || current < 1)
                    throw new InvalidOperationException("OF7 has no completed readable bar data yet.");
                Dictionary<string, object> settings = new Dictionary<string, object>();
                foreach (string name in Settings)
                {
                    object value = ReadProperty(indicator, name);
                    if (IsNumericOrBoolean(value)) settings[name] = value;
                }
                object tick = ReadProperty(indicator, "LadderTickSize");
                if (!IsNumericOrBoolean(tick)) tick = ReadProperty(indicator, "TickSize");
                settings["LadderTickSize"] = tick;
                List<object> rows = new List<object>();
                List<object> errors = new List<object>();
                int lastClosed = current - 1;
                int first = Math.Max(0, lastClosed - MaximumClosedBars + 1);
                for (int index = first; index <= lastClosed; index++)
                {
                    try
                    {
                        object bar = ValueAt(orderflow, index);
                        if (bar == null) continue;
                        rows.Add(ExportBar(indicator, bar, allSeries, index));
                    }
                    catch (Exception ex)
                    {
                        errors.Add(new Dictionary<string, object> { { "index", index }, { "error_type", RootException(ex).GetType().FullName } });
                    }
                }
                if (rows.Count == 0) throw new InvalidOperationException("No closed OF7 ladders were available.");
                Assembly assembly = indicator.GetType().Assembly;
                string hash;
                using (SHA256 sha = SHA256.Create())
                using (FileStream input = File.OpenRead(assembly.Location))
                    hash = BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
                Dictionary<string, object> payload = new Dictionary<string, object>();
                payload["schema_version"] = "of7-live-audit-v1";
                payload["captured_at_utc"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
                payload["authority"] = "read-only-existing-ninjatrader-indicator";
                payload["scope"] = "Closed stored BarData and series; current settings; no parameter changes or detector execution";
                payload["reference_sha256"] = hash;
                payload["assembly_version"] = assembly.GetName().Version.ToString();
                payload["indicator_state"] = Convert.ToString(ReadProperty(indicator, "State"), CultureInfo.InvariantCulture);
                payload["current_bar_index"] = current;
                payload["bar_orderflow_count"] = ReadProperty(orderflow, "Count");
                object instrument = ReadProperty(indicator, "Instrument");
                payload["source_contract"] = ReadProperty(instrument, "FullName");
                object period = ReadProperty(indicator, "BarsPeriod");
                payload["bars_period_type"] = Convert.ToString(ReadProperty(period, "BarsPeriodType"), CultureInfo.InvariantCulture);
                payload["bars_period_value"] = ReadProperty(period, "Value");
                payload["settings"] = settings;
                payload["bars"] = rows;
                payload["unfinished_open"] = ExportUnfinished(indicator, "_unfinishedBusinessOpen", first, lastClosed, false);
                payload["unfinished_finalized"] = ExportUnfinished(indicator, "_unfinishedBusinessFinalized", first, lastClosed, true);
                payload["bar_errors"] = errors;
                string path = Path.Combine(Path.GetTempPath(), "nttotv-of7-audit-" + DateTime.UtcNow.ToString("yyyyMMddTHHmmssfff", CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N") + ".json");
                StringBuilder json = new StringBuilder();
                WriteJson(json, payload);
                using (FileStream stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                using (StreamWriter writer = new StreamWriter(stream, new UTF8Encoding(false))) writer.Write(json.ToString());
                exportComplete = true;
                StopRetries();
                Log("exported " + rows.Count.ToString(CultureInfo.InvariantCulture) + " closed bars to " + path);
                Status("export_bar_count=" + rows.Count.ToString(CultureInfo.InvariantCulture));
            }
            catch (Exception ex)
            {
                Log("audit unavailable: " + RootException(ex).GetType().Name + " (no chart settings changed)");
                Status("export_error=" + RootException(ex).GetType().FullName);
                lock (gate) scheduled.Remove(indicator);
            }
        }

        private static object ExportBar(object indicator, object bar, IDictionary allSeries, int index)
        {
            Dictionary<string, object> row = new Dictionary<string, object>();
            row["index"] = index;
            row["ChartHigh"] = ValueAt(ReadProperty(indicator, "High"), index);
            row["ChartLow"] = ValueAt(ReadProperty(indicator, "Low"), index);
            foreach (string name in new string[] { "Open", "High", "Low", "Close", "Volume", "VolumeBid", "VolumeAsk", "VolumeBetween", "Delta", "VolumeCum", "PocPrice", "PocPriceBid", "PocPriceAsk", "ValueAreaLow", "ValueAreaHigh", "DeltaDivergenceHigh", "DeltaDivergenceLow", "PriceActionDivergenceHigh", "PriceActionDivergenceLow" })
                row[name] = ReadProperty(bar, name);
            object timestamp = ReadProperty(bar, "TimeStamp");
            if (timestamp is DateTime)
            {
                row["bar_timestamp"] = ((DateTime)timestamp).ToString("o", CultureInfo.InvariantCulture);
                row["bar_timestamp_kind"] = ((DateTime)timestamp).Kind.ToString();
            }
            object chartTime = ValueAt(ReadProperty(indicator, "Time"), index);
            if (chartTime is DateTime)
            {
                row["chart_time"] = ((DateTime)chartTime).ToString("o", CultureInfo.InvariantCulture);
                row["chart_time_kind"] = ((DateTime)chartTime).Kind.ToString();
            }
            object ladder = ReadProperty(bar, "BarLadder");
            IEnumerable keys = ReadProperty(ladder, "Keys") as IEnumerable;
            List<object> cells = new List<object>();
            if (keys != null)
            {
                PropertyInfo item = ladder.GetType().GetProperty("Item");
                foreach (object price in keys)
                {
                    object cell = item.GetValue(ladder, new object[] { price });
                    cells.Add(new Dictionary<string, object> {
                        { "price", price }, { "bid", ReadProperty(cell, "VolumeBid") },
                        { "ask", ReadProperty(cell, "VolumeAsk") }, { "between", ReadProperty(cell, "VolumeBetween") }
                    });
                }
            }
            row["cells"] = cells;
            Dictionary<string, object> series = new Dictionary<string, object>();
            foreach (DictionaryEntry entry in allSeries)
                series[Convert.ToString(entry.Key, CultureInfo.InvariantCulture)] = SeriesValue(entry.Value, index);
            row["series"] = series;
            row["ratio_buy"] = SeriesValue(ReadField(indicator, "_orderflowsRatioBuyValue"), index);
            row["ratio_sell"] = SeriesValue(ReadField(indicator, "_orderflowsRatioSellValue"), index);
            return row;
        }

        private static object ExportUnfinished(object indicator, string field, int first, int last, bool finalized)
        {
            List<object> levels = new List<object>();
            IDictionary source = ReadField(indicator, field) as IDictionary;
            if (source == null) return levels;
            foreach (DictionaryEntry entry in source)
            {
                object line = entry.Value;
                int origin = Convert.ToInt32(ReadProperty(line, "BarIndex"), CultureInfo.InvariantCulture);
                if (origin < first || origin > last) continue;
                bool high = Convert.ToBoolean(ReadProperty(line, "IsHighUnfinishedBusiness"), CultureInfo.InvariantCulture);
                levels.Add(new Dictionary<string, object> {
                    { "origin_index", origin }, { "price", ReadProperty(line, "Price") },
                    { "side", high ? "high" : "low" },
                    { "end_index", finalized ? ReadProperty(line, "BarIndexEnd") : null }
                });
            }
            return levels;
        }

        private static object SeriesValue(object series, int index)
        {
            if (series == null) return null;
            MethodInfo validMethod = series.GetType().GetMethod("IsValidDataPointAt", new Type[] { typeof(int) });
            bool valid = validMethod != null && Convert.ToBoolean(validMethod.Invoke(series, new object[] { index }), CultureInfo.InvariantCulture);
            return new Dictionary<string, object> { { "valid", valid }, { "value", valid ? ValueAt(series, index) : null } };
        }

        private static object ValueAt(object series, int index)
        {
            if (series == null) return null;
            MethodInfo method = series.GetType().GetMethod("GetValueAt", new Type[] { typeof(int) });
            return method == null ? null : method.Invoke(series, new object[] { index });
        }

        private static object ReadProperty(object target, string name)
        {
            if (target == null) return null;
            Type type = target.GetType();
            while (type != null)
            {
                PropertyInfo property = type.GetProperty(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                if (property != null && property.GetIndexParameters().Length == 0) return property.GetValue(target, null);
                type = type.BaseType;
            }
            return null;
        }

        private static object ReadField(object target, string name)
        {
            if (target == null) return null;
            Type type = target.GetType();
            while (type != null)
            {
                FieldInfo field = type.GetField(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                if (field != null) return field.GetValue(target);
                type = type.BaseType;
            }
            return null;
        }

        private static bool IsNumericOrBoolean(object value)
        {
            return value is bool || value is byte || value is short || value is int || value is long || value is float || value is double || value is decimal;
        }

        private static Exception RootException(Exception ex)
        {
            while (ex.InnerException != null) ex = ex.InnerException;
            return ex;
        }

        private static void Log(string message)
        {
            NinjaTrader.Code.Output.Process("[OF7Audit] " + message, PrintTo.OutputTab1);
        }

        private static void Status(string message)
        {
            // Bounded diagnostics contain event labels, counts and CLR type names
            // only. No chart titles, values, settings or exception messages.
            try
            {
                lock (StatusGate)
                {
                    StatusLines.Add(DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) + " " + message);
                    if (StatusLines.Count > 80) StatusLines.RemoveRange(0, StatusLines.Count - 80);
                    File.WriteAllLines(Path.Combine(Path.GetTempPath(), "nttotv-of7-audit-status.log"), StatusLines.ToArray(), new UTF8Encoding(false));
                }
            }
            catch { }
        }

        private static void WriteJson(StringBuilder builder, object value)
        {
            if (value == null) { builder.Append("null"); return; }
            string text = value as string;
            if (text != null)
            {
                builder.Append('"');
                foreach (char character in text)
                {
                    if (character == '"') builder.Append("\\\"");
                    else if (character == '\\') builder.Append("\\\\");
                    else if (character == '\n') builder.Append("\\n");
                    else if (character == '\r') builder.Append("\\r");
                    else if (character == '\t') builder.Append("\\t");
                    else if (character < 32) builder.Append("\\u" + ((int)character).ToString("x4", CultureInfo.InvariantCulture));
                    else builder.Append(character);
                }
                builder.Append('"'); return;
            }
            if (value is bool) { builder.Append((bool)value ? "true" : "false"); return; }
            if (IsNumericOrBoolean(value))
            {
                double number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
                builder.Append(double.IsNaN(number) || double.IsInfinity(number) ? "null" : Convert.ToString(value, CultureInfo.InvariantCulture));
                return;
            }
            IDictionary dictionary = value as IDictionary;
            if (dictionary != null)
            {
                builder.Append('{'); bool first = true;
                foreach (DictionaryEntry entry in dictionary)
                {
                    if (!first) builder.Append(','); first = false;
                    WriteJson(builder, Convert.ToString(entry.Key, CultureInfo.InvariantCulture)); builder.Append(':'); WriteJson(builder, entry.Value);
                }
                builder.Append('}'); return;
            }
            IEnumerable sequence = value as IEnumerable;
            if (sequence != null)
            {
                builder.Append('['); bool first = true;
                foreach (object item in sequence)
                {
                    if (!first) builder.Append(','); first = false; WriteJson(builder, item);
                }
                builder.Append(']'); return;
            }
            throw new InvalidOperationException("Unsupported audit JSON value type.");
        }
    }
}
