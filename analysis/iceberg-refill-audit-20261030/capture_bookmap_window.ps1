param([long]$WindowHandle = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BookmapWindowCapture {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
}
'@
$target = @(Get-Process -Name Bookmap | Where-Object {
    $_.MainWindowTitle -like 'GC*.COMEX*Bookmap'
})
if ($target.Count -ne 1) { throw 'Expected one Bookmap GC chart window' }
$bounds = New-Object BookmapWindowCapture+Rect
$handleToCapture = $target[0].MainWindowHandle
if ($WindowHandle -ne 0) { $handleToCapture = [IntPtr]$WindowHandle }
[uint32]$owner=0
[void][BookmapWindowCapture]::GetWindowThreadProcessId($handleToCapture,[ref]$owner)
if ($owner -ne $target[0].Id) { throw 'Capture target is not a Bookmap window' }
if (-not [BookmapWindowCapture]::GetWindowRect($handleToCapture, [ref]$bounds)) {
    throw 'Cannot read Bookmap window bounds'
}
$bitmap = New-Object System.Drawing.Bitmap ($bounds.Right - $bounds.Left), ($bounds.Bottom - $bounds.Top)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$handle = $graphics.GetHdc()
try {
    if (-not [BookmapWindowCapture]::PrintWindow($handleToCapture, $handle, 2)) {
        throw 'Bookmap window capture failed'
    }
} finally {
    $graphics.ReleaseHdc($handle)
    $graphics.Dispose()
}
$capturePath = Join-Path $PSScriptRoot ('bookmap-window-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.png')
try { $bitmap.Save($capturePath, [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $bitmap.Dispose() }
[pscustomobject]@{Path=$capturePath;Pid=$target[0].Id;Title=$target[0].MainWindowTitle} | ConvertTo-Json
