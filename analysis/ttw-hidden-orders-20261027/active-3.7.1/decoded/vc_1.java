/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
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
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.be_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fc_1;
import ttw.tradefinder.l_0;
import ttw.tradefinder.rc_2;
import ttw.tradefinder.vd_1;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.vc
 */
public class vc_1
implements l_0 {
    private ScreenSpaceCanvas.CanvasIcon K;
    private final Object E;
    private int j;
    private final fc_1 a;
    private static final int h = 200;
    private int H;
    private static final int D = 300;
    private vd_1 A;
    private static final int C = 300;
    private boolean M;
    private final K b;
    private static final int c = 10;

    public void onHeatmapPixelsHeight(int a2) {
        vc_1 a3;
        Object object = a3.E;
        synchronized (object) {
            if (a3.j == a2) {
                return;
            }
            a3.j = a2;
            a3.a();
            return;
        }
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon E() {
        vc_1 a2;
        int n2 = Math.max(200, a2.H - 300 - 300);
        BufferedImage bufferedImage = a2.a.E("hallo liebe cloud notes", n2);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, a2.H - n2 / 2);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, a2.j - 10 - bufferedImage.getHeight());
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, bufferedImage.getWidth());
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate2 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate, bufferedImage.getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(bufferedImage), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate2);
    }

    @Override
    public void E() {
        vc_1 a2;
        vc_1 vc_12 = a2;
        vc_12.dispose();
        vc_12.b.E();
    }

    private /* synthetic */ void a() {
        vc_1 a2;
        vc_1 vc_12 = a2;
        vc_12.j();
        Object object = vc_12.E;
        synchronized (object) {
            if (!a2.M || a2.A == null) {
                return;
            }
            vc_1 vc_13 = a2;
            vc_13.K = vc_13.E();
            vc_13.A.E(a2.K);
            return;
        }
    }

    private /* synthetic */ void j() {
        vc_1 a2;
        Object object = a2.E;
        synchronized (object) {
            if (a2.A != null) {
                a2.A.E();
            }
            return;
        }
    }

    public boolean E() {
        vc_1 a2;
        return a2.M;
    }

    public vc_1(f_0 a2, ze_2 a3) {
        vc_1 a4;
        vc_1 vc_12 = a4;
        vc_1 vc_13 = a4;
        a4.E = new Object();
        a4.A = null;
        vc_13.K = null;
        vc_13.M = false;
        vc_12.j = 0;
        vc_12.H = 0;
        vc_12.a = new fc_1();
        a2 = new Pc("CloudNotesValidity", Arrays.asList(cd.C, cd.c, cd.D), a2.E());
        a4.b = a2.E(new rc_2(a4));
        a4.M = true;
        a4.K = a4.E();
    }

    public void E(boolean a2) {
        vc_1 a3;
        if (a3.M == a2) {
            return;
        }
        a3.M = a2;
        if (!a3.M) {
            a3.j();
            return;
        }
        a3.a();
    }

    public void dispose() {
        vc_1 a2;
        Object object = a2.E;
        synchronized (object) {
            if (a2.A != null) {
                vd_1 vd_12 = a2.A;
                a2.A = null;
                vd_12.j();
            }
            return;
        }
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        vc_1 a3;
        Object object = a3.E;
        synchronized (object) {
            if (a3.H == a2) {
                return;
            }
            a3.H = a2;
            a3.a();
            return;
        }
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        vc_1 a3;
        Object object = a3.E;
        synchronized (object) {
            if (a3.A != null) {
                a3.A.j();
            }
            if (a2 == null) {
                return;
            }
            a3.A = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP));
        }
        a3.a();
    }
}

