using NtAddOn.Core.Configuration;

namespace NtAddOn.NinjaTrader
{
    /// <summary>
    /// Platform-agnostic metadata about the AddOn host assembly. This compiles
    /// with or without the NinjaTrader SDK present so the project always builds.
    /// The NinjaTrader-coupled entry point lives in <c>NinjaTrader/</c> and is
    /// only compiled when the NinjaTrader assemblies are available.
    /// </summary>
    public static class AddOnInfo
    {
        /// <summary>Human-readable AddOn name shown in NinjaTrader.</summary>
        public const string Name = "GC Data Bridge";

        /// <summary>Builds the default configuration used at first run.</summary>
        public static AddOnConfig DefaultConfig(params string[] candidateContracts) =>
            new AddOnConfig(candidateContracts);
    }
}
