/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$VerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory$ScreenSpaceCanvasType
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import ttw.tradefinder.Ff;
import ttw.tradefinder.V;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.fb_0;
import ttw.tradefinder.gc_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.pd_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.pA
 */
public class pa_2
implements l_0 {
    private final fb_0 J;
    private boolean G;
    private static final long d = cd_2.H;
    private long i;
    private long e;
    private long k;
    private long B;
    private boolean K;
    private pd_2 E;
    private long j;
    private int a;
    private long h;
    private boolean H;
    private final V D;
    private long A;
    private long C;
    private int M;
    private final Object b;
    private int c;

    public void onHeatmapActiveTimeWidth(long a2) {
        pa_2 a3;
        pa_2 pa_22 = a3;
        pa_22.e = a2;
        pa_22.H = true;
    }

    public void j(boolean a2) {
        pa_2 a3;
        if (a3.G == a2) {
            return;
        }
        a3.G = a2;
        if (!a3.G) {
            a3.d();
            return;
        }
        a3.E(true);
    }

    public void onHeatmapPriceHeight(long a2) {
        pa_2 a3;
        if (a3.k == a2) {
            return;
        }
        pa_2 pa_22 = a3;
        pa_22.k = a2;
        pa_22.K = true;
        a3.H = true;
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        pa_2 a3;
        if (a3.c == a2) {
            return;
        }
        a3.c = a2;
        a3.K = true;
    }

    public pa_2(V a2) {
        pa_2 a3;
        pa_2 pa_22 = a3;
        pa_2 pa_23 = a3;
        pa_2 pa_24 = a3;
        pa_2 pa_25 = a3;
        pa_2 pa_26 = a3;
        pa_2 pa_27 = a3;
        pa_2 pa_28 = a3;
        pa_2 pa_29 = a3;
        a3.b = new Object();
        a3.E = null;
        pa_29.G = false;
        pa_29.M = 0;
        pa_28.c = 0;
        pa_28.a = 0;
        pa_27.j = 0L;
        pa_27.k = 0L;
        pa_26.i = 0L;
        pa_26.B = 0L;
        pa_25.C = 0L;
        pa_25.e = 0L;
        pa_24.A = 0L;
        pa_24.h = 0L;
        pa_23.K = true;
        pa_23.H = true;
        pa_22.D = a2;
        pa_22.J = new fb_0();
        pa_22.E = null;
    }

    public boolean E(long a2) {
        pa_2 a3;
        return a2 < a3.B + a3.e && a2 > a3.B;
    }

    public boolean E() {
        pa_2 a2;
        return a2.G;
    }

    public void onRightOfTimelineWidth(int a2) {
        pa_2 a3;
        if (a3.a == a2) {
            return;
        }
        a3.a = a2;
        a3.K = true;
    }

    private /* synthetic */ void d() {
        pa_2 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.E != null) {
                a2.E.j();
            }
            return;
        }
    }

    public long E() {
        pa_2 a2;
        return a2.B + a2.e;
    }

    public void a() {
        pa_2 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.E == null) {
                return;
            }
            a2.E.j();
            return;
        }
    }

    public void onHeatmapFullTimeWidth(long a2) {
        pa_2 a3;
        if (a3.j == a2) {
            return;
        }
        a3.j = a2;
        a3.K = true;
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon E(Ff a2) {
        pa_2 a3;
        pa_2 pa_22 = a3;
        a2 = a3.J.E((Ff)a2, pa_22.M, pa_22.c, a3.k, a3.j, a3.B, a3.e, a3.i, he_1.A);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)a2.getLeft(), ((BufferedImage)a2.getRight()).getWidth());
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a2.getMiddle(), ((BufferedImage)a2.getRight()).getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage((BufferedImage)a2.getRight()), (ScreenSpaceCanvas.HorizontalCoordinate)a2.getLeft(), (ScreenSpaceCanvas.VerticalCoordinate)a2.getMiddle(), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        pa_2 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.E != null) {
                a3.E.E();
            }
            if (a2 == null) {
                return;
            }
            a3.E = new pd_2(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.E(true);
    }

    public void j() {
        pa_2 a2;
        pa_2 pa_22 = a2;
        pa_22.D.a(pa_22.B + a2.e);
    }

    public void onMoveEnd() {
        pa_2 a2;
        if (a2.B != a2.C || a2.e != a2.A) {
            pa_2 pa_22 = a2;
            pa_22.C = pa_22.B;
            pa_22.A = pa_22.e;
            pa_22.K = true;
            a2.D.a(a2.B + a2.e);
        }
        if (a2.K) {
            pa_2 pa_23 = a2;
            pa_23.E(pa_23.H);
        }
    }

    public void onHeatmapPixelsHeight(int a2) {
        pa_2 a3;
        if (a3.M == a2) {
            return;
        }
        a3.M = a2;
        a3.K = true;
    }

    public void dispose() {
        pa_2 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.E != null) {
                pd_2 pd_22 = a2.E;
                a2.E = null;
                pd_22.E();
            }
            return;
        }
    }

    public void onHeatmapTimeLeft(long a2) {
        a.B = a2;
    }

    @Override
    public void E() {
        pa_2 a2;
        a2.dispose();
    }

    public void E(boolean a2) {
        pa_2 a3;
        a3.K = false;
        a3.H = false;
        if (!a3.G) {
            return;
        }
        a2 = a2 || a3.E() > a3.h;
        Object object = a3.b;
        synchronized (object) {
            block6: {
                if (a3.E == null) {
                    return;
                }
                if (a2) break block6;
                return;
            }
            pa_2 pa_22 = a3;
            pa_22.E.j();
            pa_22.h = pa_22.E() + d;
            pa_22.D.E(a3.B, a3.E(), new gc_2(a3));
            return;
        }
    }

    public void onHeatmapPriceBottom(long a2) {
        pa_2 a3;
        if (a3.i == a2) {
            return;
        }
        a3.i = a2;
        a3.K = true;
    }
}

