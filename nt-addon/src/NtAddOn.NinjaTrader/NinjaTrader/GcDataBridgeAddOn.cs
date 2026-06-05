#if NT8
// This file is compiled ONLY when the NinjaTrader 8 assemblies are available
// (see NtAddOn.NinjaTrader.csproj). It is the NinjaTrader 8 AddOn entry point
// that hosts the live GC data bridge.
//
// Lifecycle:
//   State.SetDefaults -> set Name/Description.
//   State.Configure   -> load AddOnConfig from disk (or default), then construct
//                        and Start() the GcDataBridgeRuntime, which connects to
//                        the Backend, subscribes to the Candidate_Contracts, and
//                        forwards Level 1 trade/quote data.
//   State.Terminated  -> dispose the runtime (release subscriptions + socket).
//
// All data-capture, queueing, sequencing, serialization, reconnect, and control
// plane logic lives in the tested NtAddOn.Core components; this AddOn only owns
// configuration loading and the runtime lifetime.

using System;
using System.IO;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.AddOns;
using NtAddOn.Core.Configuration;

namespace NtAddOn.NinjaTrader
{
    /// <summary>
    /// NinjaTrader 8 AddOn entry point for the GC data bridge. Forwards GC
    /// Level 1 trade/quote data to the GC Chart Platform backend over
    /// <c>ws://host:port/ws/nt</c> (Req 1.1–1.8, 2.x, 3.x, 4.6).
    /// </summary>
    public class GcDataBridgeAddOn : AddOnBase
    {
        /// <summary>
        /// Config file name looked up under the NinjaTrader user data folder
        /// (<c>Documents\NinjaTrader 8\</c>). Operators drop a
        /// <c>gc-chart-bridge.json</c> there (copy of <c>config.sample.json</c>)
        /// to override host/port/contracts; absent that, defaults are used.
        /// </summary>
        public const string ConfigFileName = "gc-chart-bridge.json";

        private GcDataBridgeRuntime? _runtime;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "GC Data Bridge";
                Description =
                    "Forwards GC Level 1 trade/quote data to the GC Chart Platform backend.";
            }
            else if (State == State.Configure)
            {
                StartBridge();
            }
            else if (State == State.Terminated)
            {
                StopBridge();
            }
        }

        private void StartBridge()
        {
            if (_runtime != null)
            {
                return;
            }

            try
            {
                var config = LoadConfig();
                _runtime = new GcDataBridgeRuntime(config, Log);
                _runtime.Start();
            }
            catch (Exception ex)
            {
                Log("[GcDataBridge] failed to start: " + ex);
            }
        }

        private void StopBridge()
        {
            try
            {
                _runtime?.Dispose();
            }
            catch (Exception ex)
            {
                Log("[GcDataBridge] error during shutdown: " + ex.Message);
            }
            finally
            {
                _runtime = null;
            }
        }

        /// <summary>
        /// Loads the AddOn configuration from
        /// <c>Documents\NinjaTrader 8\gc-chart-bridge.json</c> when present,
        /// otherwise returns the built-in default. Never throws on a missing
        /// file (a malformed file surfaces as a logged start failure).
        /// </summary>
        private AddOnConfig LoadConfig()
        {
            var path = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, ConfigFileName);
            var config = AddOnConfigLoader.LoadOrDefault(path);
            Log(File.Exists(path)
                ? "[GcDataBridge] loaded config from " + path
                : "[GcDataBridge] config file not found; using defaults. Looked at " + path);
            return config;
        }

        /// <summary>Writes a line to the NinjaScript Output window (tab 1).</summary>
        private static void Log(string message)
        {
            try
            {
                NinjaTrader.Code.Output.Process(message, PrintTo.OutputTab1);
            }
            catch
            {
                // Output may be unavailable very early in startup; ignore.
            }
        }
    }
}
#endif
