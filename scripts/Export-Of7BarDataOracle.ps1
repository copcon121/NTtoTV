param(
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [string]$NinjaTraderBin = 'C:\Program Files\NinjaTrader 8\bin',
    [string]$Of7Dll = "$env:USERPROFILE\Documents\NinjaTrader 8\bin\Custom\OrderFlowsTrader.dll"
)

# Controlled, synthetic replay of the original public BarData type in this
# process. Does not attach to NinjaTrader, instantiate a strategy/indicator,
# invoke licensing methods, connect to a feed, or submit orders.
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputPath) { throw 'Output must be a new file.' }
$taskExpectedHash = 'd47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce'
$taskActualHash = (Get-FileHash -LiteralPath $Of7Dll -Algorithm SHA256).Hash.ToLowerInvariant()
if ($taskActualHash -ne $taskExpectedHash) { throw 'Reference DLL hash does not match this fixture version.' }
$taskCore = [Reflection.Assembly]::LoadFrom((Join-Path $NinjaTraderBin 'NinjaTrader.Core.dll'))
$taskAssembly = [Reflection.Assembly]::LoadFrom($Of7Dll)
$taskEventType = $taskCore.GetType('NinjaTrader.Data.MarketDataEventArgs', $true)
$taskMarketType = $taskCore.GetType('NinjaTrader.Data.MarketDataType', $true)
$taskBarType = $taskAssembly.GetType('NinjaTrader.NinjaScript.Indicators.BarData', $true)
$taskWhen = [DateTime]::SpecifyKind([DateTime]'2026-10-23T12:00:00', [DateTimeKind]::Utc)

# Integer price ticks in a compact synthetic range. Each tuple is price,
# volume, bid, ask. Include sparse ladders, ties, lock/cross and inside-spread.
$taskCases = [ordered]@{
    ties_and_value_area = @(@(100,10,99,100),@(102,10,101,102),@(101,2,100,101),@(103,9,102,103),@(100,1,100,101),@(101,60,100,102),@(102,50,102,103),@(100,70,99,100),@(103,80,102,103))
    same_totals_forward = @(@(100,10,99,100),@(101,10,100,101),@(102,10,101,102))
    same_totals_reverse = @(@(102,10,101,102),@(101,10,100,101),@(100,10,99,100))
    zero_side_and_sparse = @(@(100,5,99,101),@(104,10,103,105),@(102,4,102,102),@(100,11,100,101),@(104,9,103,104),@(102,7,103,101))
    ask_and_bid_poc = @(@(100,4,100,101),@(101,7,100,101),@(102,12,102,103),@(100,15,99,100),@(101,8,101,102),@(102,9,101,102),@(103,25,103,104),@(101,30,100,101))
}
$taskResults = @()
foreach ($taskCase in $taskCases.GetEnumerator()) {
    $taskBar = [Activator]::CreateInstance($taskBarType, [object[]]@($taskWhen,[decimal]1,[long]0,[long]400,[int]70,$true))
    $taskTicks = @()
    foreach ($taskTuple in $taskCase.Value) {
        $taskPrice = [int]$taskTuple[0]
        $taskVolume = [long]$taskTuple[1]
        $taskBid = [int]$taskTuple[2]
        $taskAsk = [int]$taskTuple[3]
        # NinjaTrader's constructor order is LAST, ASK, BID (not Bid, Ask).
        $taskEvent = [Activator]::CreateInstance($taskEventType, [object[]]@([double]$taskPrice,[double]$taskAsk,[double]$taskBid,$null,$false,[Enum]::ToObject($taskMarketType,2),[double]$taskPrice,$taskWhen,$taskVolume,[long]0))
        if ($taskEvent.Bid -ne $taskBid -or $taskEvent.Ask -ne $taskAsk -or $taskEvent.Price -ne $taskPrice) {
            throw 'NinjaTrader MarketDataEventArgs input roundtrip failed.'
        }
        $taskBar.AddTick([decimal]$taskPrice, $taskEvent, $taskVolume)
        $taskRows = @($taskBar.BarLadder.Keys | ForEach-Object {
            $taskRow = $taskBar.BarLadder[[decimal]$_]
            [ordered]@{price=[int]$_; bid=[long]$taskRow.VolumeBid; ask=[long]$taskRow.VolumeAsk; between=[long]$taskRow.VolumeBetween}
        })
        $taskAskImbalances = @($taskBar.BarLadder.Keys | Where-Object {$taskBar.CheckAskImbalance([decimal]$_,10)} | ForEach-Object {[int]$_})
        $taskBidImbalances = @($taskBar.BarLadder.Keys | Where-Object {$taskBar.CheckBidImbalance([decimal]$_,10)} | ForEach-Object {[int]$_})
        $taskTicks += [ordered]@{
            input=[ordered]@{price=$taskPrice; volume=$taskVolume; bid=$taskBid; ask=$taskAsk}
            expected=[ordered]@{
                open=[int]$taskBar.Open; high=[int]$taskBar.High; low=[int]$taskBar.Low; close=[int]$taskBar.Close
                volume=[long]$taskBar.Volume; delta=[long]$taskBar.Delta
                poc=[int]$taskBar.PocPrice; poc_bid=[int]$taskBar.PocPriceBid; poc_ask=[int]$taskBar.PocPriceAsk
                val=[int]$taskBar.ValueAreaLow; vah=[int]$taskBar.ValueAreaHigh
                ask_imbalances=$taskAskImbalances; bid_imbalances=$taskBidImbalances; cells=$taskRows
            }
        }
    }
    $taskResults += [ordered]@{name=$taskCase.Key; ticks=$taskTicks}
}
$taskPayload = [ordered]@{
    schema_version='of7-bardata-oracle-v1'; reference_sha256=$taskActualHash
    assembly_version=$taskAssembly.GetName().Version.ToString()
    authority='controlled-replay-original-dll'; scope='BarData.AddTick only; synthetic preprocessed ticks; no chart detector/runtime claim'
    config=[ordered]@{tick_size=1; value_area_percent=70; imbalance_in_percent=400; minimal_imbalance_volume=10}
    cases=$taskResults
}
$taskJson = ConvertTo-Json -InputObject $taskPayload -Depth 14
$taskFullOutput = [IO.Path]::GetFullPath($OutputPath)
$taskStream = [IO.File]::Open($taskFullOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
$taskWriter = New-Object IO.StreamWriter($taskStream, (New-Object Text.UTF8Encoding($false)))
try { $taskWriter.WriteLine($taskJson) } finally { $taskWriter.Dispose() }
[pscustomobject]@{Output=$taskFullOutput; Cases=$taskResults.Count; ReferenceSha256=$taskActualHash}
