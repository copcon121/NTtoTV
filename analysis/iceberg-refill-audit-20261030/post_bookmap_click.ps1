param([int]$X, [int]$Y)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BookmapPostedClick {
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
    [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr hwnd,ref Point p);
    [DllImport("user32.dll")] public static extern IntPtr ChildWindowFromPointEx(IntPtr hwnd,Point p,uint flags);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd,uint message,UIntPtr wparam,IntPtr lparam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
}
'@
$target = Get-Process -Id 10888
if ($target.ProcessName -ne 'Bookmap') { throw 'Bookmap PID changed' }
$window = $target.MainWindowHandle
$point = New-Object BookmapPostedClick+Point
$point.X=$X; $point.Y=$Y
[void][BookmapPostedClick]::ScreenToClient($window,[ref]$point)
for ($depth=0; $depth -lt 8; $depth++) {
    $child = [BookmapPostedClick]::ChildWindowFromPointEx($window,$point,7)
    if ($child -eq [IntPtr]::Zero -or $child -eq $window) { break }
    $window=$child
    $point.X=$X; $point.Y=$Y
    [void][BookmapPostedClick]::ScreenToClient($window,[ref]$point)
}
[uint32]$owner=0
[void][BookmapPostedClick]::GetWindowThreadProcessId($window,[ref]$owner)
if ($owner -ne $target.Id) { throw 'Requested window is not owned by Bookmap' }
$position = [IntPtr](($point.Y -shl 16) -bor ($point.X -band 65535))
[void][BookmapPostedClick]::PostMessage($window,0x200,[UIntPtr]::Zero,$position)
[void][BookmapPostedClick]::PostMessage($window,0x201,[UIntPtr]::new([uint32]1),$position)
[void][BookmapPostedClick]::PostMessage($window,0x202,[UIntPtr]::Zero,$position)
Start-Sleep -Milliseconds 500
& (Join-Path $PSScriptRoot 'capture_bookmap_window.ps1')
