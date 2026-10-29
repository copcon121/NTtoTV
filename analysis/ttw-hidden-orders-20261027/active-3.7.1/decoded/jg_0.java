/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory$ScreenSpaceCanvasType
 */
package ttw.tradefinder;

import ttw.tradefinder.l_0;
import ttw.tradefinder.vd_1;
import ttw.tradefinder.w_0;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.jg
 */
public class jg_0
implements l_0 {
    private boolean K;
    private long E;
    private vd_1 j;
    private long a;
    private final Object h;
    private long H;
    private boolean D;
    private long A;
    private long C;
    private final w_0 M;
    private long b;
    private boolean c;

    public void onHeatmapFullTimeWidth(long a2) {
        a.H = a2;
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        jg_0 a3;
        Object object = a3.h;
        synchronized (object) {
            if (a3.j != null) {
                a3.j.j();
            }
            if (a2 == null) {
                return;
            }
            a3.j = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.j();
    }

    public void dispose() {
        jg_0 a2;
        a2.E();
    }

    public jg_0(w_0 a2) {
        jg_0 a3;
        jg_0 jg_02 = a3;
        jg_0 jg_03 = a3;
        jg_0 jg_04 = a3;
        jg_0 jg_05 = a3;
        jg_0 jg_06 = a3;
        a3.h = new Object();
        a3.j = null;
        jg_06.c = false;
        jg_06.C = 0L;
        jg_05.E = 0L;
        jg_05.A = 0L;
        jg_04.b = 0L;
        jg_04.H = 0L;
        jg_03.a = 0L;
        jg_03.D = false;
        jg_02.K = false;
        jg_02.M = a2;
    }

    public void onMoveEnd() {
        jg_0 a2;
        a2.K = false;
        if (a2.E == 0L || a2.b == 0L || a2.a == 0L) {
            jg_0 jg_02 = a2;
            jg_02.E = jg_02.C;
            jg_02.b = jg_02.A;
            jg_02.a = jg_02.H;
            return;
        }
        boolean bl = false;
        if (a2.D) {
            bl = true;
        }
        if (a2.H != a2.a) {
            bl = true;
        }
        if (a2.C < a2.E) {
            bl = true;
        }
        if (a2.C > a2.E && a2.A >= a2.H) {
            bl = true;
        }
        if (a2.b >= a2.a && a2.A < a2.H) {
            bl = true;
        }
        jg_0 jg_03 = a2;
        jg_03.D = false;
        jg_03.E = jg_03.C;
        jg_03.b = jg_03.A;
        jg_03.a = jg_03.H;
        if (bl) {
            jg_0 jg_04 = a2;
            jg_04.a();
            jg_04.E(jg_04.C, a2.C + a2.A);
        }
    }

    public boolean E() {
        jg_0 a2;
        return a2.c;
    }

    private /* synthetic */ void E(long a2, long a3) {
        jg_0 a4;
        if (!a4.c) {
            return;
        }
        a4.M.j(a2, a3);
    }

    public void E(boolean a2) {
        jg_0 a3;
        if (a3.c == a2) {
            return;
        }
        a3.c = a2;
        if (!a3.c) {
            a3.a();
            return;
        }
        jg_0 jg_02 = a3;
        jg_02.E(jg_02.C, a3.C + a3.A);
    }

    public void onHeatmapActiveTimeWidth(long a2) {
        a.A = a2;
    }

    private /* synthetic */ void a() {
        jg_0 a2;
        Object object = a2.h;
        synchronized (object) {
            if (a2.j != null) {
                a2.j.E();
            }
            return;
        }
    }

    public long E() {
        jg_0 a2;
        return a2.C;
    }

    public void onMoveStart() {
        a.K = true;
    }

    public void E(ScreenSpaceCanvas.CanvasIcon a2) {
        jg_0 a3;
        Object object = a3.h;
        synchronized (object) {
            if (!a3.c || a3.j == null) {
                return;
            }
            a3.j.E(a2);
            return;
        }
    }

    public void onHeatmapTimeLeft(long a2) {
        a.C = a2;
    }

    public void E(long a2) {
        jg_0 a3;
        if (a3.K) {
            a3.D = true;
        }
    }

    @Override
    public void E() {
        jg_0 a2;
        Object object = a2.h;
        synchronized (object) {
            if (a2.j != null) {
                vd_1 vd_12 = a2.j;
                a2.j = null;
                vd_12.j();
            }
            return;
        }
    }

    public void j() {
        jg_0 a2;
        jg_0 jg_02 = a2;
        jg_02.a();
        jg_02.E(jg_02.C, a2.C + a2.A);
    }
}

