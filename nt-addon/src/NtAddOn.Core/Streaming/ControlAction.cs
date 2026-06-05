namespace NtAddOn.Core.Streaming
{
    /// <summary>
    /// The action carried by a <see cref="ControlCommand"/> sent from the
    /// Backend to the NT_AddOn over <c>/ws/nt</c> (design "WebSocket Message
    /// Schemas"; Req 1.7, 1.8).
    /// </summary>
    public enum ControlAction
    {
        /// <summary>
        /// Begin subscribing to the Level 1 trade and quote feeds of the
        /// command's contract (Req 1.7).
        /// </summary>
        Subscribe = 0,

        /// <summary>
        /// Stop subscribing to the Level 1 trade and quote feeds of the
        /// command's contract (Req 1.8).
        /// </summary>
        Unsubscribe = 1,
    }
}
