param(
    [string]$BookmapHome = "C:\Program Files\Bookmap",
    [string]$BridgeRoot = "C:\Users\Administrator\Desktop\NTtoTV\bookmap-bridge",
    [string]$OutputJar = "",
    [string]$StopsIcebergsJar = ""
)

$ErrorActionPreference = "Stop"

$javaHome = Join-Path $BookmapHome "jre\bin"
$javac = Join-Path $javaHome "javac.exe"
$jar = Join-Path $javaHome "jar.exe"
if (!(Test-Path -LiteralPath $javac)) {
    throw "javac.exe not found at $javac"
}
if (!(Test-Path -LiteralPath $jar)) {
    throw "jar.exe not found at $jar"
}

$lib = Join-Path $BridgeRoot "lib"
$build = Join-Path $BridgeRoot "build"
$classes = Join-Path $build "classes"
New-Item -ItemType Directory -Force -Path $lib, $classes | Out-Null
$extractStamp = Get-Date -Format "yyyyMMddHHmmssfff"

$resolvedBridgeRoot = (Resolve-Path -LiteralPath $BridgeRoot).Path
$resolvedBuild = (Resolve-Path -LiteralPath $build).Path
if (!$resolvedBuild.StartsWith($resolvedBridgeRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved build path is outside bridge root: $resolvedBuild"
}

$broadcastingApi = Join-Path $lib "broadcasting-api-0.54.jar"
$sitProviderApi = Join-Path $lib "SitIndicator-1.18-brapi-api.jar"

if (!(Test-Path -LiteralPath $broadcastingApi)) {
    Invoke-WebRequest `
        -UseBasicParsing `
        -Uri "https://raw.githubusercontent.com/BookmapAPI/brapi-demo-consumer/main/mavenLib/com/bookmap/addons/broadcasting-api/0.54/broadcasting-api-0.54.jar" `
        -OutFile $broadcastingApi
}

if (!(Test-Path -LiteralPath $sitProviderApi)) {
    Invoke-WebRequest `
        -UseBasicParsing `
        -Uri "https://raw.githubusercontent.com/BookmapAPI/brapi-demo-consumer/main/providers/modules/7.3.0.1---7.5.1.9999---0.01---SitIndicator---1.18---0.08.jar" `
        -OutFile $sitProviderApi
}

$bookmapApi = Join-Path $BookmapHome "lib\bm-l1api.jar"
$bookmapSimplifiedApi = Join-Path $BookmapHome "lib\bm-simplified-api-wrapper.jar"
foreach ($path in @($bookmapApi, $bookmapSimplifiedApi, $broadcastingApi, $sitProviderApi)) {
    if (!(Test-Path -LiteralPath $path)) {
        throw "Required jar not found: $path"
    }
}

$resolvedClasses = (Resolve-Path -LiteralPath $classes).Path
if (!$resolvedClasses.StartsWith($resolvedBuild, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved classes path is outside build dir: $resolvedClasses"
}
Get-ChildItem -LiteralPath $classes -Recurse -Force | Remove-Item -Force -Recurse

$sources = Get-ChildItem -LiteralPath (Join-Path $BridgeRoot "src\main\java") -Recurse -Filter "*.java" |
    ForEach-Object { $_.FullName }
if (!$sources) {
    throw "No Java sources found"
}
$sourcesFile = Join-Path $build "sources.txt"
$sources |
    ForEach-Object { '"' + ($_ -replace '\\', '\\') + '"' } |
    Set-Content -LiteralPath $sourcesFile -Encoding ASCII

$classpath = @($bookmapApi, $bookmapSimplifiedApi, $broadcastingApi, $sitProviderApi) -join ";"
& $javac -encoding UTF-8 -source 17 -target 17 -classpath $classpath -d $classes "@$sourcesFile"
if ($LASTEXITCODE -ne 0) {
    throw "javac failed with exit code $LASTEXITCODE"
}

if ([string]::IsNullOrWhiteSpace($OutputJar)) {
    $outJar = Join-Path $build "NTtoTV-Bookmap-SI-Bridge.jar"
} elseif ([IO.Path]::IsPathRooted($OutputJar)) {
    $outJar = $OutputJar
} else {
    $outJar = Join-Path $build $OutputJar
}
$outDir = Split-Path -Parent $outJar
if (![string]::IsNullOrWhiteSpace($outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}
if (Test-Path -LiteralPath $outJar) {
    Remove-Item -LiteralPath $outJar -Force
}

Push-Location $classes
try {
    & $jar cf $outJar .
    if ($LASTEXITCODE -ne 0) {
        throw "jar failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

foreach ($dependency in @($broadcastingApi, $sitProviderApi)) {
    $extract = Join-Path $build ("extract-" + [IO.Path]::GetFileNameWithoutExtension($dependency) + "-" + $extractStamp)
    New-Item -ItemType Directory -Path $extract | Out-Null
    Push-Location $extract
    try {
        & $jar xf $dependency
        & $jar uf $outJar .
    } finally {
        Pop-Location
    }
}

if ([string]::IsNullOrWhiteSpace($StopsIcebergsJar)) {
    $rootCandidate = Join-Path (Split-Path -Parent $BridgeRoot) "stops-icebergs-on-chart-1.17.jar"
    $desktopCandidate = Join-Path ([Environment]::GetFolderPath("Desktop")) "stops-icebergs-on-chart-1.17.jar"
    if (Test-Path -LiteralPath $rootCandidate) {
        $StopsIcebergsJar = $rootCandidate
    } elseif (Test-Path -LiteralPath $desktopCandidate) {
        $StopsIcebergsJar = $desktopCandidate
    }
}

if (![string]::IsNullOrWhiteSpace($StopsIcebergsJar) -and (Test-Path -LiteralPath $StopsIcebergsJar)) {
    $legacyExtract = Join-Path $build ("extract-" + [IO.Path]::GetFileNameWithoutExtension($StopsIcebergsJar) + "-legacy-broadcast-" + $extractStamp)
    New-Item -ItemType Directory -Path $legacyExtract | Out-Null
    Push-Location $legacyExtract
    try {
        & $jar xf $StopsIcebergsJar `
            "velox/indicators/sionchart/OrderEventType.class" `
            "velox/indicators/sionchart/broadcast/Event.class" `
            "velox/indicators/sionchart/broadcast/Helper.class" `
            "velox/indicators/sionchart/broadcast/Snapshot.class" `
            "velox/indicators/sionchart/broadcast/SubscribeMessage.class" `
            "velox/indicators/sionchart/broadcast/Subscription.class" `
            "velox/indicators/sionchart/broadcast/SubscriptionType.class" `
            "velox/indicators/sionchart/broadcast/UnsubscribeMessage.class"
        & $jar uf $outJar .
    } finally {
        Pop-Location
    }
}

[pscustomobject]@{
    Jar = $outJar
    BookmapHome = $BookmapHome
    BroadcastingApi = $broadcastingApi
    SitProviderApi = $sitProviderApi
    StopsIcebergsJar = $StopsIcebergsJar
}
