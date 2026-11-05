param([int]$X, [int]$Y, [switch]$Click, [switch]$KeepForeground,
      [int]$ThenX=-1, [int]$ThenY=-1)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BookmapScopedHover {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd,int index);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int cx,int cy,uint flags);
}
'@
$target = Get-Process -Id 10888
if ($target.ProcessName -ne 'Bookmap') { throw 'Bookmap PID changed' }
$previousWindow = [BookmapScopedHover]::GetForegroundWindow()
$previousCursor = New-Object BookmapScopedHover+Point
[void][BookmapScopedHover]::GetCursorPos([ref]$previousCursor)
$bounds = New-Object BookmapScopedHover+Rect
[void][BookmapScopedHover]::GetWindowRect($target.MainWindowHandle, [ref]$bounds)
$raised = $false
try {
    if ([BookmapScopedHover]::GetForegroundWindow() -ne $target.MainWindowHandle) {
        [uint32]$foregroundPid = 0
        $foregroundThread = [BookmapScopedHover]::GetWindowThreadProcessId($previousWindow,[ref]$foregroundPid)
        $currentThread = [BookmapScopedHover]::GetCurrentThreadId()
        $attached = [BookmapScopedHover]::AttachThreadInput($currentThread,$foregroundThread,$true)
        try {
            [void][BookmapScopedHover]::SetForegroundWindow($target.MainWindowHandle)
            Start-Sleep -Milliseconds 300
        }
        finally {
            if ($attached) { [void][BookmapScopedHover]::AttachThreadInput($currentThread,$foregroundThread,$false) }
        }
        [uint32]$actualForegroundPid = 0
        [void][BookmapScopedHover]::GetWindowThreadProcessId([BookmapScopedHover]::GetForegroundWindow(),[ref]$actualForegroundPid)
        if ($actualForegroundPid -ne $target.Id) {
            if (([BookmapScopedHover]::GetWindowLong($target.MainWindowHandle,-20) -band 8) -eq 0) {
                $raised = [BookmapScopedHover]::SetWindowPos($target.MainWindowHandle,[IntPtr](-1),0,0,0,0,3)
            }
        }
    }
    Start-Sleep -Milliseconds 300
    $point = New-Object BookmapScopedHover+Point
    $point.X = [Math]::Max(0, $bounds.Left) + $X
    $point.Y = [Math]::Max(0, $bounds.Top) + $Y
    [uint32]$owner = 0
    [void][BookmapScopedHover]::GetWindowThreadProcessId([BookmapScopedHover]::WindowFromPoint($point),[ref]$owner)
    if ($owner -ne $target.Id) { throw 'Hover point is not owned by Bookmap' }
    [void][BookmapScopedHover]::SetCursorPos($point.X, $point.Y)
    if ($Click) {
        [BookmapScopedHover]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
        [BookmapScopedHover]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
    }
    if ($ThenX -ge 0 -and $ThenY -ge 0) {
        Start-Sleep -Milliseconds 400
        $nextPoint = New-Object BookmapScopedHover+Point
        $nextPoint.X = [Math]::Max(0,$bounds.Left) + $ThenX
        $nextPoint.Y = [Math]::Max(0,$bounds.Top) + $ThenY
        [uint32]$nextOwner = 0
        [void][BookmapScopedHover]::GetWindowThreadProcessId([BookmapScopedHover]::WindowFromPoint($nextPoint),[ref]$nextOwner)
        if ($nextOwner -ne $target.Id) { throw 'Second click target is not Bookmap' }
        [void][BookmapScopedHover]::SetCursorPos($nextPoint.X,$nextPoint.Y)
        [BookmapScopedHover]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
        [BookmapScopedHover]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
    }
    Start-Sleep -Milliseconds 1300
    $left = [Math]::Max(0, $bounds.Left)
    $top = [Math]::Max(0, $bounds.Top)
    $bitmap = New-Object System.Drawing.Bitmap ($bounds.Right - $left), ($bounds.Bottom - $top)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
        $capturePath = Join-Path $PSScriptRoot ('bookmap-hover-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.png')
        $bitmap.Save($capturePath, [System.Drawing.Imaging.ImageFormat]::Png)
        [pscustomobject]@{Path=$capturePath;X=$X;Y=$Y} | ConvertTo-Json
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
} finally {
    [void][BookmapScopedHover]::SetCursorPos($previousCursor.X, $previousCursor.Y)
    if ($raised) { [void][BookmapScopedHover]::SetWindowPos($target.MainWindowHandle,[IntPtr](-2),0,0,0,0,3) }
    if (-not $KeepForeground) { [void][BookmapScopedHover]::SetForegroundWindow($previousWindow) }
}
