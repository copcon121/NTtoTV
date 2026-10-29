/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$VerticalCoordinate
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.PF;
import ttw.tradefinder.c_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.jc_0;
import ttw.tradefinder.jg_0;
import ttw.tradefinder.l_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.w_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;

/*
 * Renamed from ttw.tradefinder.Kb
 */
public abstract class kb_2
extends xb_2
implements w_0,
c_0,
o_0 {
    private final boolean H;
    private PF D;
    private final jg_0 A;
    private static int C = 2000000;
    private boolean M;
    private static int b = 600000;
    private long c;

    public void j(jc_0 a2, long a3) {
        kb_2 a4;
        PF pF = a4.D;
        synchronized (pF) {
            a4.D.E(a3, a2);
        }
        if (!a4.H) {
            return;
        }
        if (!a4.M) {
            return;
        }
        if (!a4.A.boolean_E()) {
            return;
        }
        a4.E(a2, a3);
    }

    @Override
    public void void_E(boolean a22) {
        kb_2 kb_22;
        kb_2 a3;
        if (a22) {
            PF a22 = a3.D;
            synchronized (a22) {
                a3.D.a();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : a
                kb_22 = a3;
            }
        } else {
            kb_22 = a3;
        }
        kb_22.A.j();
    }

    @Override
    public void void_j() {
        kb_2 a2;
        kb_2 kb_22 = a2;
        super.void_j();
        kb_22.void_E(true);
        kb_22.A.void_E();
    }

    public kb_2(f_0 a2, ze_2 a3, s_0 a4) {
        kb_2 a5;
        kb_2 kb_22 = a5;
        kb_2 kb_23 = a5;
        super(a2, a3, a4);
        a5.D = new PF(b, C, true);
        kb_23.c = 0L;
        kb_23.M = false;
        kb_23.A = new jg_0(a5);
        kb_22.H = a2.boolean_j();
        kb_22.M = false;
    }

    @Override
    public boolean boolean_E() {
        kb_2 a2;
        return a2.A.boolean_E();
    }

    public boolean boolean_j() {
        return false;
    }

    public abstract Pair<BufferedImage, Integer> E(jc_0 var1);

    @Override
    public void void_j(long a2) {
        kb_2 a3;
        a3.A.E(a2);
        a3.c = 0L;
    }

    private /* synthetic */ void E(jc_0 a2, long a32) {
        kb_2 a4;
        a4.c = a32;
        a2 = a4.E((jc_0)a2);
        BufferedImage a32 = (BufferedImage)a2.getLeft();
        ScreenSpaceCanvas.PreparedImage preparedImage = new ScreenSpaceCanvas.PreparedImage(a32);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, a4.c), -(a32.getWidth() / 2));
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, a32.getWidth());
        a2 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, ((Integer)a2.getRight()).intValue());
        a32 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a2, a32.getHeight());
        a2 = new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)a2, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)a32);
        a4.A.E((ScreenSpaceCanvas.CanvasIcon)a2);
    }

    @Override
    public void j(long a22, long a3) {
        kb_2 a4;
        PF pF = a4.D;
        synchronized (pF) {
            int a22 = a4.D.j(a22);
            if (a22 == -1) {
                return;
            }
            int n2 = a22 = a22;
            while (n2 < a4.D.int_E()) {
                long l2 = a4.D.long_E(a22);
                if (l2 > a3) {
                    return;
                }
                kb_2 kb_22 = a4;
                kb_22.E(kb_22.D.ttw_tradefinder_jc_0_E(a22++), l2);
                n2 = a22;
            }
            return;
        }
    }

    @Override
    public void void_E() {
        kb_2 a2;
        super.void_E();
        a2.c = 0L;
    }

    @Override
    public l_0 ttw_tradefinder_l_0_E() {
        kb_2 a2;
        return a2.A;
    }

    public void a(boolean a2) {
        kb_2 a3;
        if (a3.A.boolean_E() == a2) {
            return;
        }
        kb_2 kb_22 = a3;
        boolean bl = a2;
        kb_22.A.E(bl);
        kb_22.j(bl);
    }

    @Override
    public void void_E(long a22) {
        kb_2 a3;
        if (!a3.A.boolean_E() || a3.H) {
            return;
        }
        Pair<Long, jc_0> a22 = a3.E(a22);
        if (a22 != null && a3.c != (Long)a22.getKey() && (Long)a22.getKey() > a3.A.long_E()) {
            a3.E((jc_0)a22.getValue(), (Long)a22.getKey());
        }
    }

    private /* synthetic */ Pair<Long, jc_0> E(long a22) {
        kb_2 a3;
        PF pF = a3.D;
        synchronized (pF) {
            int a22 = a3.D.E(a22);
            if (a22 == -1) {
                return null;
            }
            return Pair.of((Object)a3.D.long_E(a22), (Object)a3.D.ttw_tradefinder_jc_0_E(a22));
        }
    }
}

