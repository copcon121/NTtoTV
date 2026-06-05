using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NtAddOn.Core.Json;

namespace NtAddOn.Core.Configuration
{
    /// <summary>
    /// Loads an <see cref="AddOnConfig"/> from a JSON file on disk, or returns a
    /// sensible default when no file is present. Platform-agnostic (no
    /// NinjaTrader dependency) and dependency-free (parses via
    /// <see cref="SimpleJson"/>), so it builds and runs anywhere and is unit
    /// testable.
    ///
    /// <para>The on-disk shape matches <c>config.sample.json</c>:</para>
    /// <code>
    /// {
    ///   "candidateContracts": ["GC 08-26", "GC 10-26", "GC 12-26"],
    ///   "backendHost": "127.0.0.1",
    ///   "backendPort": 8000,
    ///   "backendPath": "/ws/nt",
    ///   "queueCapacity": 10000,
    ///   "criticalOverloadThreshold": 9000,
    ///   "compressionEnabled": false,
    ///   "manualContractOverride": null
    /// }
    /// </code>
    /// </summary>
    public static class AddOnConfigLoader
    {
        /// <summary>
        /// Loads configuration from <paramref name="path"/>. When the file does
        /// not exist, returns <see cref="CreateDefault"/>. Throws
        /// <see cref="FormatException"/> when the file exists but is not a valid
        /// JSON object, and propagates <see cref="ArgumentException"/> from
        /// <see cref="AddOnConfig"/> validation when values are invalid.
        /// </summary>
        public static AddOnConfig LoadOrDefault(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                return CreateDefault();
            }

            var text = File.ReadAllText(path);
            return Parse(text);
        }

        /// <summary>
        /// Parses an <see cref="AddOnConfig"/> from a JSON string. Throws
        /// <see cref="FormatException"/> when the text is not a JSON object.
        /// </summary>
        public static AddOnConfig Parse(string json)
        {
            if (!SimpleJson.TryParse(json, out var root) ||
                !(root is IReadOnlyDictionary<string, object?> obj))
            {
                throw new FormatException("Configuration must be a JSON object.");
            }

            var candidates = ReadStringArray(obj, "candidateContracts");
            if (candidates.Count == 0)
            {
                // Fall back to the default candidate set when the file omits it,
                // so a partially-filled config still yields a working AddOn.
                candidates = DefaultCandidateContracts().ToList();
            }

            return new AddOnConfig(
                candidates,
                backendHost: ReadString(obj, "backendHost", AddOnConfig.DefaultBackendHost),
                backendPort: ReadInt(obj, "backendPort", AddOnConfig.DefaultBackendPort),
                queueCapacity: ReadInt(obj, "queueCapacity", AddOnConfig.DefaultQueueCapacity),
                criticalOverloadThreshold: ReadInt(
                    obj, "criticalOverloadThreshold", AddOnConfig.DefaultCriticalOverloadThreshold),
                compressionEnabled: ReadBool(obj, "compressionEnabled", false),
                manualContractOverride: ReadOptionalString(obj, "manualContractOverride"),
                backendPath: ReadString(obj, "backendPath", AddOnConfig.DefaultPath));
        }

        /// <summary>
        /// The default configuration used when no config file is present:
        /// the default GC candidate contracts pointed at the loopback Backend.
        /// </summary>
        public static AddOnConfig CreateDefault()
        {
            return new AddOnConfig(DefaultCandidateContracts());
        }

        /// <summary>
        /// The default GC Candidate_Contract list. These are placeholders the
        /// operator should adjust to the GC contract months their NinjaTrader
        /// data feed actually provides (see README / config.sample.json).
        /// </summary>
        public static IReadOnlyList<string> DefaultCandidateContracts() =>
            new[] { "GC 06-26", "GC 08-26", "GC 12-26" };

        private static IReadOnlyList<string> ReadStringArray(
            IReadOnlyDictionary<string, object?> obj, string key)
        {
            if (obj.TryGetValue(key, out var raw) && raw is IReadOnlyList<object?> list)
            {
                return list.OfType<string>()
                    .Select(s => s.Trim())
                    .Where(s => s.Length > 0)
                    .ToList();
            }

            return new List<string>();
        }

        private static string ReadString(
            IReadOnlyDictionary<string, object?> obj, string key, string fallback)
        {
            return obj.TryGetValue(key, out var raw) && raw is string s && s.Trim().Length > 0
                ? s.Trim()
                : fallback;
        }

        private static string? ReadOptionalString(
            IReadOnlyDictionary<string, object?> obj, string key)
        {
            return obj.TryGetValue(key, out var raw) && raw is string s && s.Trim().Length > 0
                ? s.Trim()
                : null;
        }

        private static int ReadInt(
            IReadOnlyDictionary<string, object?> obj, string key, int fallback)
        {
            return obj.TryGetValue(key, out var raw) && raw is double d
                ? (int)Math.Round(d)
                : fallback;
        }

        private static bool ReadBool(
            IReadOnlyDictionary<string, object?> obj, string key, bool fallback)
        {
            return obj.TryGetValue(key, out var raw) && raw is bool b ? b : fallback;
        }
    }
}
