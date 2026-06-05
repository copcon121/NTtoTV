using System;
using System.Collections.Generic;
using System.Linq;

namespace NtAddOn.Core.Configuration
{
    /// <summary>
    /// Configuration model for the NinjaTrader 8 GC AddOn.
    ///
    /// This is the single source of truth for the AddOn's runtime settings as
    /// described in the design's "NT_AddOn ... Configuration" section:
    /// candidate contract list, Backend host/port, queue capacity,
    /// critical-overload threshold, compression on/off, and an optional manual
    /// contract override.
    ///
    /// The type is platform-agnostic (no NinjaTrader dependency) so it can be
    /// constructed, validated, and property-tested without NinjaTrader present.
    ///
    /// Requirements: 1.5 (subscribe to every configured Candidate_Contract on
    /// start), with fields supporting Requirements 2.4-2.6 (queue capacity /
    /// critical-overload threshold), 2.2 (compression), 10.4 (manual override),
    /// and 1.4 (Backend host/port for ws://127.0.0.1:&lt;port&gt;/ws/nt).
    /// </summary>
    public sealed class AddOnConfig
    {
        /// <summary>Default Backend host (loopback only in v1).</summary>
        public const string DefaultBackendHost = "127.0.0.1";

        /// <summary>Default Backend port for the ws://.../ws/nt endpoint.</summary>
        public const int DefaultBackendPort = 8000;

        /// <summary>Default Bounded_Queue capacity.</summary>
        public const int DefaultQueueCapacity = 10_000;

        /// <summary>
        /// Default critical-overload threshold. At/above this depth the queue is
        /// considered critically overloaded and trade events may be dropped with
        /// a log entry (Req 2.6). Below it, every trade is retained (Req 2.4).
        /// </summary>
        public const int DefaultCriticalOverloadThreshold = 9_000;

        /// <summary>Default WebSocket path on the Backend.</summary>
        public const string DefaultPath = "/ws/nt";

        /// <summary>
        /// The list of GC Candidate_Contracts the AddOn subscribes to on start
        /// so the Contract_Resolver receives per-candidate activity (Req 1.5).
        /// Order is preserved; duplicates are not allowed (see Validate).
        /// </summary>
        public IReadOnlyList<string> CandidateContracts { get; }

        /// <summary>Backend host for the WebSocket client connection (Req 1.4).</summary>
        public string BackendHost { get; }

        /// <summary>Backend TCP port for the WebSocket client connection (Req 1.4).</summary>
        public int BackendPort { get; }

        /// <summary>WebSocket path on the Backend (defaults to /ws/nt).</summary>
        public string BackendPath { get; }

        /// <summary>Fixed capacity of the Bounded_Queue (Req 2.4-2.6).</summary>
        public int QueueCapacity { get; }

        /// <summary>
        /// Queue depth at/above which the queue is treated as critically
        /// overloaded and trades may be dropped (Req 2.6). Must be in the
        /// range (0, QueueCapacity].
        /// </summary>
        public int CriticalOverloadThreshold { get; }

        /// <summary>
        /// Whether outbound payloads are compressed by the background worker
        /// before transmission (Req 2.2). Compression never runs on the
        /// NinjaTrader callback path.
        /// </summary>
        public bool CompressionEnabled { get; }

        /// <summary>
        /// Optional manual contract override. When set (non-null/non-empty),
        /// the platform charts this contract and auto-resolution is disabled
        /// (Req 10.4). When null, auto-resolution is in effect.
        /// </summary>
        public string? ManualContractOverride { get; }

        /// <summary>
        /// True when a manual contract override is configured (Req 10.4).
        /// </summary>
        public bool HasManualOverride => !string.IsNullOrWhiteSpace(ManualContractOverride);

        /// <summary>
        /// Constructs an immutable, validated configuration. Throws
        /// <see cref="ArgumentException"/> when any value is invalid.
        /// </summary>
        public AddOnConfig(
            IEnumerable<string> candidateContracts,
            string backendHost = DefaultBackendHost,
            int backendPort = DefaultBackendPort,
            int queueCapacity = DefaultQueueCapacity,
            int criticalOverloadThreshold = DefaultCriticalOverloadThreshold,
            bool compressionEnabled = false,
            string? manualContractOverride = null,
            string backendPath = DefaultPath)
        {
            if (candidateContracts == null)
            {
                throw new ArgumentNullException(nameof(candidateContracts));
            }

            var contracts = candidateContracts
                .Select(c => c?.Trim() ?? string.Empty)
                .ToList();

            CandidateContracts = contracts;
            BackendHost = backendHost?.Trim() ?? string.Empty;
            BackendPort = backendPort;
            BackendPath = string.IsNullOrWhiteSpace(backendPath) ? DefaultPath : backendPath.Trim();
            QueueCapacity = queueCapacity;
            CriticalOverloadThreshold = criticalOverloadThreshold;
            CompressionEnabled = compressionEnabled;
            ManualContractOverride = string.IsNullOrWhiteSpace(manualContractOverride)
                ? null
                : manualContractOverride.Trim();

            Validate();
        }

        /// <summary>
        /// Builds the Backend WebSocket URI (ws://host:port/path) for the
        /// AddOn's client connection (Req 1.4).
        /// </summary>
        public Uri BuildBackendUri()
        {
            var path = BackendPath.StartsWith("/", StringComparison.Ordinal)
                ? BackendPath
                : "/" + BackendPath;
            return new Uri($"ws://{BackendHost}:{BackendPort}{path}");
        }

        /// <summary>
        /// Validates the configuration invariants. Kept as a public method so
        /// callers loading config from disk can re-validate after deserialization.
        /// </summary>
        public void Validate()
        {
            if (CandidateContracts.Count == 0)
            {
                throw new ArgumentException(
                    "At least one Candidate_Contract must be configured (Req 1.5).",
                    nameof(CandidateContracts));
            }

            if (CandidateContracts.Any(string.IsNullOrWhiteSpace))
            {
                throw new ArgumentException(
                    "Candidate_Contract identifiers must be non-empty.",
                    nameof(CandidateContracts));
            }

            var distinctCount = CandidateContracts
                .Distinct(StringComparer.Ordinal)
                .Count();
            if (distinctCount != CandidateContracts.Count)
            {
                throw new ArgumentException(
                    "Candidate_Contract list must not contain duplicates.",
                    nameof(CandidateContracts));
            }

            if (string.IsNullOrWhiteSpace(BackendHost))
            {
                throw new ArgumentException("Backend host must be set.", nameof(BackendHost));
            }

            if (BackendPort < 1 || BackendPort > 65535)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(BackendPort), BackendPort, "Backend port must be in 1..65535.");
            }

            if (QueueCapacity < 1)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(QueueCapacity), QueueCapacity, "Queue capacity must be >= 1.");
            }

            if (CriticalOverloadThreshold < 1 || CriticalOverloadThreshold > QueueCapacity)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(CriticalOverloadThreshold),
                    CriticalOverloadThreshold,
                    "Critical-overload threshold must be in the range (0, QueueCapacity].");
            }

            if (HasManualOverride &&
                !CandidateContracts.Contains(ManualContractOverride!, StringComparer.Ordinal))
            {
                throw new ArgumentException(
                    "Manual contract override must be one of the configured Candidate_Contracts (Req 10.4).",
                    nameof(ManualContractOverride));
            }
        }
    }
}
