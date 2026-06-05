namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// Connection state emitted by the AddOn when its link to the Backend
    /// changes. (Req 3.4, 20.1)
    /// </summary>
    public enum ConnectionStatus
    {
        /// <summary>Connected and forwarding data normally.</summary>
        Connected = 0,

        /// <summary>Connected but data is non-contiguous or impaired.</summary>
        Degraded = 1,

        /// <summary>Not connected to the Backend.</summary>
        Disconnected = 2,
    }
}
