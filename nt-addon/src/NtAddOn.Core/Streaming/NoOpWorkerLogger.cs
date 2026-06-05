using System;

namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Default logger used when a host has not supplied a concrete sink yet.
    /// </summary>
    public sealed class NoOpWorkerLogger : IWorkerLogger
    {
        /// <summary>A shared no-op logger instance.</summary>
        public static readonly NoOpWorkerLogger Instance = new NoOpWorkerLogger();

        private NoOpWorkerLogger()
        {
        }

        /// <inheritdoc />
        public void LogInfo(string message)
        {
        }

        /// <inheritdoc />
        public void LogError(string message, Exception? exception)
        {
        }
    }
}
