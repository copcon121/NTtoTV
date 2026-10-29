/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataVerticalCoordinate
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
import ttw.tradefinder.df_0;
import ttw.tradefinder.fb_1;
import ttw.tradefinder.hK;
import ttw.tradefinder.l_0;
import ttw.tradefinder.n_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.vd_1;
import ttw.tradefinder.wb_0;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Renamed from ttw.tradefinder.uC
 */
public class uc_0
implements l_0,
n_0 {
    private int j;
    private long a;
    private boolean h;
    private int H;
    private final df_0<oa_0, hK> D;
    private int A;
    private vd_1 C;
    private boolean M;
    private final Object b;
    private static final int c = 20;

    @Override
    public void void_E() {
        uc_0 a2;
        uc_0 uc_02 = a2;
        uc_02.dispose();
        uc_02.D.j(a2);
    }

    private /* synthetic */ void a() {
        uc_0 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.C != null) {
                a2.C.void_E();
            }
            return;
        }
    }

    public void j() {
        uc_0 a2;
        uc_0 uc_02 = a2;
        uc_02.a();
        if (uc_02.j < 100) {
            return;
        }
        ((oa_0)a2.D.M).E(new fb_1(a2));
    }

    public void onMoveEnd() {
        uc_0 a2;
        if (!a2.M) {
            return;
        }
        a2.M = false;
        a2.j();
    }

    public void onHeatmapPixelsHeight(int a2) {
        uc_0 a3;
        if (a3.H == a2) {
            return;
        }
        a3.H = a2;
        a3.M = true;
    }

    public void onHeatmapPriceHeight(long a2) {
        uc_0 a3;
        if (a3.a == a2) {
            return;
        }
        a3.a = a2;
        a3.M = true;
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        uc_0 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.C != null) {
                a3.C.j();
            }
            if (a2 == null) {
                return;
            }
            a3.C = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.j();
    }

    public void dispose() {
        uc_0 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.C != null) {
                vd_1 vd_12 = a2.C;
                a2.C = null;
                vd_12.j();
            }
            return;
        }
    }

    public void E(int a2) {
        uc_0 a3;
        if (a2 == 0) {
            return;
        }
        a3.A = a2;
        if (!a3.h) {
            a3.h = true;
            a3.j();
        }
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        uc_0 a3;
        if (a3.j == a2) {
            return;
        }
        a3.j = a2;
        a3.M = true;
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon E(na_0 a2) {
        uc_0 a3;
        boolean bl = a2.H <= a3.A;
        int n2 = a3.j - 40;
        BufferedImage bufferedImage = wb_0.E(a2, n2, bl);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, 20);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, n2);
        if (bl) {
            a2 = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, (double)a2.H);
            ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a2, -bufferedImage.getHeight());
            return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(bufferedImage), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)a2);
        }
        a2 = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, (double)a2.H);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a2, bufferedImage.getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(bufferedImage), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)a2, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }

    public uc_0(df_0<oa_0, hK> a2) {
        uc_0 a3;
        uc_0 uc_02 = a3;
        uc_0 uc_03 = a3;
        uc_0 uc_04 = a3;
        a3.b = new Object();
        a3.C = null;
        uc_04.H = 0;
        uc_04.j = 0;
        uc_03.a = 0L;
        uc_03.A = 0;
        uc_02.h = 0;
        uc_02.M = false;
        a3.D = a2;
        a3.D.E(a3);
        a3.h = false;
    }

    @Override
    public void E(pf_0 a2) {
        if (a2 == pf_0.r) {
            uc_0 a3;
            a3.j();
        }
    }
}

