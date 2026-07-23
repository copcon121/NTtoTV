param(
    [string]$BookmapHome = "C:\Program Files\Bookmap",
    [string]$BridgeRoot = "C:\Users\Administrator\Desktop\NTtoTV\bookmap-bridge",
    [string]$OutputJar = "",
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

$javaBin = Join-Path $BookmapHome "jre\bin"
$javac = Join-Path $javaBin "javac.exe"
$java = Join-Path $javaBin "java.exe"
$jar = Join-Path $javaBin "jar.exe"
foreach ($path in @($javac, $java, $jar)) {
    if (!(Test-Path -LiteralPath $path)) {
        throw "Required Java tool not found: $path"
    }
}

$bookmapApi = Join-Path $BookmapHome "lib\bm-l1api.jar"
$bookmapSimplifiedApi = Join-Path $BookmapHome "lib\bm-simplified-api-wrapper.jar"
foreach ($path in @($bookmapApi, $bookmapSimplifiedApi)) {
    if (!(Test-Path -LiteralPath $path)) {
        throw "Required Bookmap API jar not found: $path"
    }
}

$resolvedBridgeRoot = (Resolve-Path -LiteralPath $BridgeRoot).Path
$build = Join-Path $resolvedBridgeRoot "build\market-data"
$classes = Join-Path $build "classes"
$testClasses = Join-Path $build "test-classes"
New-Item -ItemType Directory -Force -Path $classes, $testClasses | Out-Null

$resolvedBuild = (Resolve-Path -LiteralPath $build).Path
if (!$resolvedBuild.StartsWith($resolvedBridgeRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved build path is outside bridge root: $resolvedBuild"
}
foreach ($target in @($classes, $testClasses)) {
    $resolvedTarget = (Resolve-Path -LiteralPath $target).Path
    if (!$resolvedTarget.StartsWith($resolvedBuild, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Resolved class path is outside build dir: $resolvedTarget"
    }
    Get-ChildItem -LiteralPath $resolvedTarget -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force
}

$sourceRoot = Join-Path $resolvedBridgeRoot "src\main\java\com\nttotv\bookmap"
$sources = @(
    Join-Path $sourceRoot "BookmapFootprintAccumulator.java"
    Join-Path $sourceRoot "BookmapMarketDataBridge.java"
)
foreach ($source in $sources) {
    if (!(Test-Path -LiteralPath $source)) {
        throw "Market-data bridge source not found: $source"
    }
}

$classpath = @($bookmapApi, $bookmapSimplifiedApi) -join ";"
& $javac -encoding UTF-8 -source 17 -target 17 -classpath $classpath -d $classes $sources
if ($LASTEXITCODE -ne 0) {
    throw "javac failed with exit code $LASTEXITCODE"
}

if (!$SkipTests) {
    $testSource = Join-Path $resolvedBridgeRoot "src\test\java\com\nttotv\bookmap\BookmapFootprintAccumulatorTest.java"
    if (!(Test-Path -LiteralPath $testSource)) {
        throw "Market-data bridge test source not found: $testSource"
    }
    $testClasspath = @($classes, $bookmapApi, $bookmapSimplifiedApi) -join ";"
    & $javac -encoding UTF-8 -source 17 -target 17 -classpath $testClasspath -d $testClasses $testSource
    if ($LASTEXITCODE -ne 0) {
        throw "test javac failed with exit code $LASTEXITCODE"
    }
    $runClasspath = @($testClasses, $classes, $bookmapApi, $bookmapSimplifiedApi) -join ";"
    & $java -classpath $runClasspath com.nttotv.bookmap.BookmapFootprintAccumulatorTest
    if ($LASTEXITCODE -ne 0) {
        throw "market-data bridge tests failed with exit code $LASTEXITCODE"
    }
}

if ([string]::IsNullOrWhiteSpace($OutputJar)) {
    $outJar = Join-Path $build "NTtoTV-Bookmap-Market-Data-Shadow.jar"
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

[pscustomobject]@{
    Jar = $outJar
    Tests = if ($SkipTests) { "skipped" } else { "passed" }
    BookmapApi = $bookmapApi
    SimplifiedApi = $bookmapSimplifiedApi
}
