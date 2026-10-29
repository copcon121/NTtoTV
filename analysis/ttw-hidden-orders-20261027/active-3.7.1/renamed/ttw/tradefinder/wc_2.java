/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$VerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory$ScreenSpaceCanvasType
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import java.util.Arrays;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ej;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua_2;
import ttw.tradefinder.vd_1;
import ttw.tradefinder.x;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Renamed from ttw.tradefinder.WC
 */
public class wc_2
implements l_0,
n_0 {
    private long F;
    private static final int J = 5;
    private static final int G = 5;
    private final K d;
    private int i;
    private static final int e = 20;
    private long k;
    private final Object B;
    private final df_0<dc_2, ej> K;
    private long E;
    private int j;
    private long a;
    private vd_1 h;
    private static final int H = 5;
    private long D;
    private long A;
    private boolean C;
    private final bb_2 M;
    private x b;
    private Pair<Integer, Integer> c;

    public void E(boolean a2) {
        wc_2 a3;
        if (a3.C == a2) {
            return;
        }
        a3.C = a2;
        if (!a3.C) {
            a3.a();
            return;
        }
        a3.j();
    }

    private /* synthetic */ void a() {
        wc_2 a2;
        Object object = a2.B;
        synchronized (object) {
            if (a2.h != null) {
                a2.h.void_E();
            }
            return;
        }
    }

    private /* synthetic */ void j() {
        wc_2 a2;
        wc_2 wc_22 = a2;
        wc_22.a();
        Object object = wc_22.B;
        synchronized (object) {
            if (!a2.C || a2.h == null) {
                return;
            }
            a2.h.E(a2.velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$CanvasIcon_E());
            return;
        }
    }

    public void dispose() {
        wc_2 a2;
        Object object = a2.B;
        synchronized (object) {
            if (a2.h != null) {
                vd_1 vd_12 = a2.h;
                a2.h = null;
                vd_12.j();
            }
            return;
        }
    }

    public void E(pb_2 a2, ac_2 a3) {
        wc_2 a4;
        wc_2 wc_22 = a4;
        wc_22.M.E(a2);
        wc_22.M.E(a3);
        wc_22.j();
    }

    public void onMoveEnd() {
        wc_2 a2;
        if (a2.F == 0L || a2.A == 0L || a2.D == 0L) {
            return;
        }
        if (a2.F != a2.k || a2.A != a2.E || a2.D != a2.a) {
            wc_2 wc_22 = a2;
            wc_22.k = wc_22.F;
            wc_22.E = wc_22.A;
            wc_22.a = wc_22.D;
            if (wc_22.b != null) {
                wc_2 wc_23 = a2;
                wc_23.b.E(wc_23.F + a2.A, a2.A < a2.D);
            }
        }
    }

    @Override
    public void void_E() {
        wc_2 a2;
        wc_2 wc_22 = a2;
        wc_22.dispose();
        wc_22.d.void_E();
        wc_22.K.j(a2);
    }

    public void onHeatmapFullTimeWidth(long a2) {
        wc_2 a3;
        a3.D = a2;
        if (a3.a == 0L) {
            a3.onMoveEnd();
        }
    }

    public void onHeatmapTimeLeft(long a2) {
        wc_2 a3;
        a3.F = a2;
        if (a3.k == 0L) {
            a3.onMoveEnd();
        }
    }

    public void onHeatmapActiveTimeWidth(long a2) {
        wc_2 a3;
        a3.A = a2;
        if (a3.E == 0L) {
            a3.onMoveEnd();
        }
    }

    public boolean boolean_E() {
        wc_2 a2;
        return a2.C;
    }

    public wc_2(String a2, f_0 a3, ze_2 a4, df_0<dc_2, ej> a5, x a6) {
        wc_2 a7;
        wc_2 wc_22 = a7;
        wc_2 wc_23 = a7;
        wc_2 wc_24 = a7;
        wc_2 wc_25 = a7;
        wc_2 wc_26 = a7;
        a7.B = new Object();
        a7.h = null;
        wc_26.C = false;
        wc_26.c = Pair.of((Object)0, (Object)0);
        wc_25.j = 0;
        wc_25.i = 0;
        wc_24.F = 0L;
        wc_24.k = 0L;
        wc_23.A = 0L;
        wc_23.E = 0L;
        wc_22.D = 0L;
        wc_22.a = 0L;
        a7.M = new bb_2(a4);
        a7.M.E((float)((dc_2)((df_0)a5).M).c / 10.0f);
        a7.b = a6;
        a7.K = a5;
        a7.K.E(a7);
        a5 = new Pc(gb_1.E(")(\u00144\f%\f5\u001c\u0011\u0004(\u000b5\u000033 \t(\u0001(\u00118"), Arrays.asList(cd.C, cd.c, cd.D), a3.ttw_tradefinder_qc_1_E());
        a7.d = a5.E(new ua_2(a7, a3, a2, a4));
        a7.C = ((dc_2)a7.K.M).C != kc_1.A;
    }

    private /* synthetic */ ScreenSpaceCanvas.HorizontalCoordinate E(ScreenSpaceCanvas.HorizontalCoordinate a2) {
        wc_2 a3;
        return new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate(a2, ((Integer)a3.c.getLeft()).intValue());
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$CanvasIcon_E() {
        wc_2 a2;
        wc_2 wc_22 = a2;
        BufferedImage bufferedImage = wc_22.M.E((dc_2)wc_22.K.M);
        wc_2 wc_23 = a2;
        wc_23.c = Pair.of((Object)bufferedImage.getWidth(), (Object)bufferedImage.getHeight());
        ScreenSpaceCanvas.HorizontalCoordinate horizontalCoordinate = wc_23.velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$HorizontalCoordinate_E();
        ScreenSpaceCanvas.VerticalCoordinate verticalCoordinate = wc_23.velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$VerticalCoordinate_E();
        ScreenSpaceCanvas.HorizontalCoordinate horizontalCoordinate2 = horizontalCoordinate;
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(bufferedImage), horizontalCoordinate2, verticalCoordinate, a2.E(horizontalCoordinate2), a2.E(verticalCoordinate));
    }

    private /* synthetic */ ScreenSpaceCanvas.VerticalCoordinate velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$VerticalCoordinate_E() {
        wc_2 a2;
        switch (((dc_2)a2.K.M).C) {
            case C: 
            case b: {
                wc_2 wc_22 = a2;
                return new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, wc_22.j - (Integer)wc_22.c.getRight() - 5);
            }
            case D: 
            case M: {
                return new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, 5);
            }
        }
        wc_2 wc_23 = a2;
        return new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, wc_23.j - (Integer)wc_23.c.getRight() - 5);
    }

    public void onHeatmapPixelsHeight(int a2) {
        wc_2 a3;
        Object object = a3.B;
        synchronized (object) {
            if (a3.j == a2) {
                return;
            }
            a3.j = a2;
            a3.j();
            return;
        }
    }

    private /* synthetic */ ScreenSpaceCanvas.VerticalCoordinate E(ScreenSpaceCanvas.VerticalCoordinate a2) {
        wc_2 a3;
        return new ScreenSpaceCanvas.RelativePixelVerticalCoordinate(a2, ((Integer)a3.c.getRight()).intValue());
    }

    private /* synthetic */ ScreenSpaceCanvas.HorizontalCoordinate velox_api_layer1_layers_strategies_interfaces_ScreenSpaceCanvas$HorizontalCoordinate_E() {
        wc_2 a2;
        switch (((dc_2)a2.K.M).C) {
            case C: 
            case D: {
                return new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, 5);
            }
            case b: 
            case M: {
                wc_2 wc_22 = a2;
                return new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, wc_22.i - (Integer)wc_22.c.getLeft() - 20);
            }
        }
        return new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, 5);
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        wc_2 a3;
        Object object = a3.B;
        synchronized (object) {
            if (a3.i == a2) {
                return;
            }
            a3.i = a2;
            a3.j();
            return;
        }
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        wc_2 a3;
        Object object = a3.B;
        synchronized (object) {
            if (a3.h != null) {
                a3.h.j();
            }
            if (a2 == null) {
                return;
            }
            a3.h = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.j();
    }

    @Override
    public void E(pf_0 a2) {
        wc_2 a3;
        if (a2 == pf_0.Z || a2 == pf_0.C) {
            if (!a3.C) {
                return;
            }
            a3.j();
        }
        if (a2 == pf_0.v) {
            wc_2 wc_22 = a3;
            wc_22.M.E((float)((dc_2)wc_22.K.M).c / 10.0f);
            if (!a3.C) {
                return;
            }
            a3.j();
        }
    }
}

