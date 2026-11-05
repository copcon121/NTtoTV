Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class BookmapWindows {
 public delegate bool EnumCallback(IntPtr h,IntPtr l);
 public class Window { public long Handle; public string Class; public string Title; public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumCallback cb,IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 public static List<Window> Find(uint pid){var o=new List<Window>();EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p); if(p==pid && IsWindowVisible(h)){var t=new StringBuilder(200);var c=new StringBuilder(100);Rect r;GetWindowText(h,t,200);GetClassName(h,c,100);GetWindowRect(h,out r);o.Add(new Window{Handle=h.ToInt64(),Class=c.ToString(),Title=t.ToString(),Left=r.Left,Top=r.Top,Right=r.Right,Bottom=r.Bottom});}return true;},IntPtr.Zero);return o;}
}
'@
[BookmapWindows]::Find(10888) | ConvertTo-Json -Depth 3
