/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory$ScreenSpaceCanvasType
 */
package ttw.tradefinder;

import ttw.tradefinder.W;
import ttw.tradefinder.l_0;
import ttw.tradefinder.vd_1;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

public class rC
implements l_0 {
    private long a;
    private int h;
    private boolean H;
    private vd_1 D;
    private final Object A;
    private long C;
    private final W M;
    private long b;
    private long c;

    public void onMoveEnd() {
        rC a2;
        if (a2.c != a2.a || a2.b != a2.C) {
            rC rC2 = a2;
            rC2.a = rC2.c;
            rC2.C = rC2.b;
            rC2.a();
        }
    }

    public void a() {
        rC a2;
        rC rC2 = a2;
        rC2.j();
        rC2.M.E(a2.c, a2.c + a2.b);
    }

    public void onHeatmapActiveTimeWidth(long a2) {
        a.b = a2;
    }

    private /* synthetic */ void j() {
        rC a2;
        Object object = a2.A;
        synchronized (object) {
            if (a2.D != null) {
                a2.D.void_E();
            }
            return;
        }
    }

    public boolean boolean_E() {
        rC a2;
        return a2.H;
    }

    public void onHeatmapPixelsHeight(int a2) {
        a.h = a2;
    }

    public int int_E() {
        rC a2;
        return a2.h;
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        rC a3;
        Object object = a3.A;
        synchronized (object) {
            if (a3.D != null) {
                a3.D.j();
            }
            if (a2 == null) {
                return;
            }
            a3.D = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.a();
    }

    public void dispose() {
        rC a2;
        Object object = a2.A;
        synchronized (object) {
            if (a2.D != null) {
                vd_1 vd_12 = a2.D;
                a2.D = null;
                vd_12.j();
            }
            return;
        }
    }

    public boolean E(long a2) {
        rC a3;
        if (a2 < a3.c) {
            return false;
        }
        return a2 <= a3.c + a3.b;
    }

    public rC(W a2) {
        rC a3;
        rC rC2 = a3;
        rC rC3 = a3;
        rC rC4 = a3;
        rC rC5 = a3;
        a3.A = new Object();
        rC5.D = null;
        rC5.H = false;
        rC4.c = 0L;
        rC4.a = 0L;
        rC3.b = 0L;
        rC3.C = 0L;
        rC2.h = 0;
        rC2.M = a2;
    }

    public void E(boolean a2) {
        rC a3;
        if (a3.H == a2) {
            return;
        }
        a3.H = a2;
        if (!a3.H) {
            a3.j();
            return;
        }
        a3.a();
    }

    public void onHeatmapTimeLeft(long a2) {
        a.c = a2;
    }

    public void E(ScreenSpaceCanvas.CanvasIcon a2) {
        rC a3;
        Object object = a3.A;
        synchronized (object) {
            if (!a3.H || a3.D == null) {
                return;
            }
            a3.D.E(a2);
            return;
        }
    }

    @Override
    public void void_E() {
        rC a2;
        a2.dispose();
    }
}

