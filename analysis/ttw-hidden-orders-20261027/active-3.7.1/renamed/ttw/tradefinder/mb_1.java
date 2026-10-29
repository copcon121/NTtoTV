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

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.Oe;
import ttw.tradefinder.R;
import ttw.tradefinder.ab_1;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.in;
import ttw.tradefinder.l_0;
import ttw.tradefinder.nb_0;
import ttw.tradefinder.pd_2;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Renamed from ttw.tradefinder.mB
 */
public class mb_1
implements l_0 {
    private long I;
    private long f;
    private long F;
    private long J;
    private static final long G = cd_2.H;
    private boolean d;
    private long i;
    private int e;
    private final df_0<ua_0, in> k;
    private int B;
    private final ze_2 K;
    private final Object E;
    private long j;
    private pd_2 a;
    private boolean h;
    private final ab_1 H;
    private long D;
    private Map<String, Oe> A;
    private int C;
    private boolean M;
    private final R b;
    private long c;

    public void dispose() {
        mb_1 a2;
        Object object = a2.E;
        synchronized (object) {
            if (a2.a != null) {
                pd_2 pd_22 = a2.a;
                a2.a = null;
                pd_22.void_E();
            }
            return;
        }
    }

    public void j(Oe a2) {
        mb_1 a3;
        Object object = a3.E;
        synchronized (object) {
            mb_1 mb_12 = a3;
            mb_12.A.remove(a2.D);
            if (!mb_12.d) {
                return;
            }
            if (a3.a == null) {
                return;
            }
            a3.a.E(a2.D);
            return;
        }
    }

    private /* synthetic */ void d() {
        mb_1 a2;
        Object object = a2.E;
        synchronized (object) {
            if (a2.a != null) {
                a2.a.j();
            }
            return;
        }
    }

    public long long_E() {
        mb_1 a2;
        return a2.i + a2.j;
    }

    public void onHeatmapPriceHeight(long a2) {
        mb_1 a3;
        if (a3.c == a2) {
            return;
        }
        mb_1 mb_12 = a3;
        mb_12.c = a2;
        mb_12.h = true;
        a3.M = true;
    }

    public void a() {
        mb_1 a2;
        mb_1 mb_12 = a2;
        mb_12.b.A(mb_12.i + a2.j);
    }

    public void onHeatmapFullTimeWidth(long a2) {
        mb_1 a3;
        if (a3.D == a2) {
            return;
        }
        a3.D = a2;
        a3.h = true;
    }

    public void onMoveEnd() {
        mb_1 a2;
        if (a2.i != a2.J || a2.j != a2.F) {
            mb_1 mb_12 = a2;
            mb_12.J = mb_12.i;
            mb_12.F = mb_12.j;
            mb_12.h = true;
            a2.b.A(a2.i + a2.j);
        }
        if (a2.h) {
            mb_1 mb_13 = a2;
            mb_13.E(mb_13.M);
        }
    }

    public void j(boolean a2) {
        mb_1 a3;
        if (a3.d == a2) {
            return;
        }
        a3.d = a2;
        if (!a3.d) {
            a3.d();
            return;
        }
        a3.E(true);
    }

    public void j() {
        mb_1 a2;
        Object object = a2.E;
        synchronized (object) {
            mb_1 mb_12 = a2;
            mb_12.A.clear();
            if (mb_12.a == null) {
                return;
            }
            a2.a.j();
            return;
        }
    }

    public boolean boolean_E(Oe a2) {
        mb_1 a3;
        if (a2 == null) {
            return false;
        }
        return a2.c < a3.i + a3.j && (a2.b > a3.i || !a2.boolean_j());
    }

    public mb_1(ze_2 a2, df_0<ua_0, in> a3, R a4, boolean a5) {
        mb_1 a6;
        mb_1 mb_12 = a6;
        mb_1 mb_13 = a6;
        mb_1 mb_14 = a6;
        mb_1 mb_15 = a6;
        mb_1 mb_16 = a6;
        mb_1 mb_17 = a6;
        mb_1 mb_18 = a6;
        mb_1 mb_19 = a6;
        mb_1 mb_110 = a6;
        mb_1 mb_111 = a6;
        mb_111.E = new Object();
        mb_111.a = null;
        mb_111.A = new HashMap<String, Oe>();
        mb_110.d = false;
        mb_110.e = 0;
        mb_19.C = 0;
        mb_19.B = 0;
        mb_18.D = 0L;
        mb_18.c = 0L;
        mb_17.f = 0L;
        mb_17.i = 0L;
        mb_16.J = 0L;
        mb_16.j = 0L;
        mb_15.F = 0L;
        mb_15.I = 0L;
        mb_14.h = true;
        mb_14.M = true;
        mb_13.b = a4;
        mb_13.K = a2;
        mb_12.k = a3;
        mb_12.H = new ab_1(a5);
        mb_12.a = null;
    }

    public void onHeatmapTimeLeft(long a2) {
        a.i = a2;
    }

    @Override
    public void void_E() {
        mb_1 a2;
        mb_1 mb_12 = a2;
        mb_12.dispose();
        Object object = mb_12.E;
        synchronized (object) {
            a2.A.clear();
            return;
        }
    }

    public void E(boolean a2) {
        mb_1 a3;
        a3.h = false;
        a3.M = false;
        if (!a3.d) {
            return;
        }
        a2 = a2 || a3.long_E() > a3.I;
        Object object = a3.E;
        synchronized (object) {
            if (a3.a == null) {
                return;
            }
            if (a2) {
                a3.a.j();
            }
            for (Oe oe : a3.A.values()) {
                if (!a3.boolean_E(oe)) continue;
                a3.a.E(oe.D, a3.velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$CanvasIcon_E(oe));
            }
            if (!a2) {
                return;
            }
            mb_1 mb_12 = a3;
            mb_12.I = mb_12.long_E() + G;
            if (((ua_0)mb_12.k.M).D == df_1.c) {
                mb_1 mb_13 = a3;
                mb_13.b.j(mb_13.i, a3.long_E(), new nb_0(a3));
            }
            return;
        }
    }

    public boolean E(long a2, long a3) {
        mb_1 a4;
        return a2 < a4.i + a4.j && a3 > a4.i;
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        mb_1 a3;
        if (a3.C == a2) {
            return;
        }
        a3.C = a2;
        a3.h = true;
    }

    public void onHeatmapActiveTimeWidth(long a2) {
        mb_1 a3;
        mb_1 mb_12 = a3;
        mb_12.j = a2;
        mb_12.M = true;
    }

    public void onRightOfTimelineWidth(int a2) {
        mb_1 a3;
        if (a3.B == a2) {
            return;
        }
        a3.B = a2;
        a3.h = true;
    }

    public void onHeatmapPriceBottom(long a2) {
        mb_1 a3;
        if (a3.f == a2) {
            return;
        }
        a3.f = a2;
        a3.h = true;
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        mb_1 a3;
        Object object = a3.E;
        synchronized (object) {
            if (a3.a != null) {
                a3.a.void_E();
            }
            if (a2 == null) {
                return;
            }
            a3.a = new pd_2(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.E(true);
    }

    public void onHeatmapPixelsHeight(int a2) {
        mb_1 a3;
        if (a3.e == a2) {
            return;
        }
        a3.e = a2;
        a3.h = true;
    }

    public boolean boolean_E() {
        mb_1 a2;
        return a2.d;
    }

    public void void_E(Oe a2) {
        mb_1 a3;
        Object object = a3.E;
        synchronized (object) {
            mb_1 mb_12 = a3;
            mb_12.A.put(a2.D, a2);
            if (!mb_12.d) {
                return;
            }
            if (a3.a == null) {
                return;
            }
            if (a3.boolean_E(a2)) {
                a3.a.E(a2.D, a3.velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$CanvasIcon_E(a2));
            }
            return;
        }
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$CanvasIcon_E(Oe a2) {
        mb_1 a3;
        mb_1 mb_12 = a3;
        Color color = a2.M ? ((ua_0)mb_12.k.M).b : ((ua_0)mb_12.k.M).c;
        mb_1 mb_13 = a3;
        a2 = a3.H.E((Oe)a2, mb_13.e, mb_13.C, a3.c, a3.D, a3.i, a3.j, a3.f, a3.K, color, ((ua_0)a3.k.M).a, ((ua_0)a3.k.M).M);
        color = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)a2.getLeft(), ((BufferedImage)a2.getRight()).getWidth());
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a2.getMiddle(), ((BufferedImage)a2.getRight()).getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage((BufferedImage)a2.getRight()), (ScreenSpaceCanvas.HorizontalCoordinate)a2.getLeft(), (ScreenSpaceCanvas.VerticalCoordinate)a2.getMiddle(), (ScreenSpaceCanvas.HorizontalCoordinate)color, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }
}

