/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
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
import java.util.TreeMap;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.LC;
import ttw.tradefinder.Pd;
import ttw.tradefinder.df_0;
import ttw.tradefinder.im;
import ttw.tradefinder.l_0;
import ttw.tradefinder.p_0;
import ttw.tradefinder.vd_1;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.db
 */
public class db_2
implements l_0 {
    private long I;
    private static final int f = 5;
    private final p_0 F;
    private boolean J;
    private final Pd G;
    private final TreeMap<Integer, ScreenSpaceCanvas.CanvasIcon> d;
    private long i;
    private long e;
    private int k;
    private long B;
    private long K;
    private long E;
    private int j;
    private final ze_2 a;
    private double h;
    private boolean H;
    private final Object D;
    private long A;
    private final df_0<LC, im> C;
    private int M;
    private final int b = 10;
    private vd_1 c;

    private /* synthetic */ void a() {
        db_2 a2;
        Object object = a2.D;
        synchronized (object) {
            if (a2.c != null) {
                a2.c.E();
            }
            a2.d.clear();
            return;
        }
    }

    public void onHeatmapActiveTimeWidth(long a2) {
        a.i = a2;
    }

    public void dispose() {
        db_2 a2;
        Object object = a2.D;
        synchronized (object) {
            if (a2.c != null) {
                vd_1 vd_12 = a2.c;
                a2.c = null;
                vd_12.j();
            }
            return;
        }
    }

    public void E(long a22, int a3) {
        db_2 a4;
        if (!a4.J) {
            return;
        }
        if (a22 < a4.A || a22 > a4.A + a4.i) {
            return;
        }
        if ((long)a3 < a4.K || (long)a3 > a4.K + a4.E) {
            return;
        }
        Pair<Double, Double> a22 = a4.F.E(a3, a4.A, a4.A + a4.i);
        if ((Double)a22.getLeft() > a4.h || (Double)a22.getRight() > a4.h) {
            a4.j();
            return;
        }
        Object object = a4.D;
        synchronized (object) {
            Object object2;
            if (a4.c == null) {
                return;
            }
            ScreenSpaceCanvas.CanvasIcon canvasIcon = a4.d.get(a3);
            if (canvasIcon != null) {
                object2 = object;
                db_2 db_22 = a4;
                canvasIcon.setImage(db_22.E(a3, a22, db_22.h).getImage());
            } else {
                db_2 db_23 = a4;
                db_2 db_24 = a4;
                canvasIcon = db_24.E(a3, a22, db_24.h);
                db_23.c.E(canvasIcon);
                db_23.d.put(a3, canvasIcon);
                object2 = object;
            }
            // ** MonitorExit[v0] (shouldn't be in output)
            return;
        }
    }

    public void onHeatmapTimeLeft(long a2) {
        a.A = a2;
    }

    public db_2(ze_2 a2, p_0 a3, df_0<LC, im> a4) {
        db_2 a5;
        db_2 db_22 = a5;
        db_2 db_23 = a5;
        db_2 db_24 = a5;
        db_2 db_25 = a5;
        db_2 db_26 = a5;
        db_2 db_27 = a5;
        db_2 db_28 = a5;
        db_2 db_29 = a5;
        db_2 db_210 = a5;
        a5.b = 10;
        a5.D = new Object();
        db_210.c = null;
        db_210.J = false;
        db_29.j = 0;
        db_29.M = 0;
        db_28.k = 0;
        db_28.I = 0L;
        db_27.E = 0L;
        db_27.K = 0L;
        db_26.A = 0L;
        db_26.B = 0L;
        db_25.i = 0L;
        db_25.e = 0L;
        db_24.H = true;
        db_24.h = 0.0;
        db_23.G = new Pd();
        db_23.d = new TreeMap();
        db_23.F = a3;
        db_22.C = a4;
        db_22.a = a2;
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon E(int a22, Pair<Double, Double> a3, double a42) {
        db_2 a5;
        int n2 = Math.max(1, (int)((long)a5.j / Math.max(1L, a5.E)));
        int n3 = a5.k - 20;
        int n4 = Math.max(40, Math.min(40 + ((LC)a5.C.M).c, n3));
        n3 = Math.max(10, 10 + (int)((double)(n3 - n4) / 100.0 * (double)((LC)a5.C.M).C));
        a3 = a5.G.E((Pair<Double, Double>)a3, a42, n4, n2, a5.a);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate a42 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, n3);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a22 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_DATA_ZERO, (double)(a22 - 1)), n2 / 2 + 1);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)a42, n4);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a22, n2);
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(a3), (ScreenSpaceCanvas.HorizontalCoordinate)a42, (ScreenSpaceCanvas.VerticalCoordinate)a22, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }

    @Override
    public void E() {
        db_2 a2;
        db_2 db_22 = a2;
        db_22.dispose();
        Object object = db_22.D;
        synchronized (object) {
            a2.d.clear();
            return;
        }
    }

    public void onRightOfTimelineWidth(int a2) {
        db_2 a3;
        if (a3.k == a2) {
            return;
        }
        a3.k = a2;
        a3.H = true;
    }

    public void onHeatmapFullTimeWidth(long a2) {
        db_2 a3;
        if (a3.I == a2) {
            return;
        }
        a3.I = a2;
        a3.H = true;
    }

    public void onHeatmapPriceBottom(long a2) {
        db_2 a3;
        if (a3.K == a2) {
            return;
        }
        a3.K = a2;
        a3.H = true;
    }

    public void E(boolean a2) {
        db_2 a3;
        if (a3.J == a2) {
            return;
        }
        a3.J = a2;
        if (!a3.J) {
            a3.a();
            return;
        }
        a3.j();
    }

    public void onMoveEnd() {
        db_2 a2;
        if (a2.A != a2.B || a2.i != a2.e) {
            db_2 db_22 = a2;
            db_22.B = db_22.A;
            db_22.e = db_22.i;
            a2.H = true;
        }
        if (a2.H) {
            a2.H = false;
            a2.j();
        }
    }

    public void j() {
        db_2 a2;
        db_2 db_22 = a2;
        db_22.a();
        db_22.j();
    }

    public void onHeatmapPriceHeight(long a2) {
        db_2 a3;
        if (a3.E == a2) {
            return;
        }
        a3.E = a2;
        a3.H = true;
    }

    public boolean j() {
        db_2 a2;
        if (!a2.J) {
            return false;
        }
        Object object = a2.D;
        synchronized (object) {
            Object object2;
            int n2;
            if (a2.c == null) {
                return false;
            }
            db_2 db_22 = a2;
            db_22.c.E();
            db_22.d.clear();
            double d2 = 0.0;
            double d3 = 0.0;
            double d4 = 0.0;
            TreeMap<Integer, Object> treeMap = new TreeMap<Integer, Object>();
            int n3 = n2 = (int)a2.K;
            while ((long)n3 <= a2.K + a2.E) {
                object2 = a2.F.E(n2, a2.A, a2.A + a2.i);
                if (object2 != null) {
                    d2 = Math.max((Double)object2.getLeft(), d2);
                    d2 = Math.max((Double)object2.getRight(), d2);
                    treeMap.put(n2, object2);
                    d3 += ((Double)object2.getRight()).doubleValue();
                    d4 += ((Double)object2.getLeft()).doubleValue();
                }
                n3 = ++n2;
            }
            a2.h = d2;
            ScreenSpaceCanvas.CanvasIcon canvasIcon = treeMap.entrySet().iterator();
            block4: while (true) {
                ScreenSpaceCanvas.CanvasIcon canvasIcon2 = canvasIcon;
                while (canvasIcon2.hasNext()) {
                    object2 = canvasIcon.next();
                    ScreenSpaceCanvas.CanvasIcon canvasIcon3 = a2.E((Integer)object2.getKey(), (Pair<Double, Double>)((Pair)object2.getValue()), a2.h);
                    if (canvasIcon3 == null) continue block4;
                    db_2 db_23 = a2;
                    db_23.c.E(canvasIcon3);
                    db_23.d.put((Integer)object2.getKey(), canvasIcon3);
                    canvasIcon2 = canvasIcon;
                }
                break;
            }
            canvasIcon = a2.E(d3, d4);
            if (canvasIcon != null) {
                a2.c.E(canvasIcon);
            }
        }
        return false;
    }

    public boolean E() {
        db_2 a2;
        return a2.J;
    }

    public void onHeatmapPixelsHeight(int a2) {
        db_2 a3;
        if (a3.j == a2) {
            return;
        }
        a3.j = a2;
        a3.H = true;
    }

    public void onHeatmapFullPixelsWidth(int a2) {
        db_2 a3;
        if (a3.M == a2) {
            return;
        }
        a3.M = a2;
        a3.H = true;
    }

    @Override
    public void E(ScreenSpaceCanvasFactory a2) {
        db_2 a3;
        Object object = a3.D;
        synchronized (object) {
            if (a3.c != null) {
                a3.c.j();
            }
            if (a2 == null) {
                return;
            }
            a3.c = new vd_1(a2.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.RIGHT_OF_TIMELINE));
        }
        a3.j();
    }

    private /* synthetic */ ScreenSpaceCanvas.CanvasIcon E(double a22, double a32) {
        db_2 a4;
        int n2 = a4.k - 20;
        int n3 = Math.max(40, Math.min(40 + ((LC)a4.C.M).c, n2));
        n2 = Math.max(10, 10 + (int)((double)(n2 - n3) / 100.0 * (double)((LC)a4.C.M).C));
        BufferedImage a22 = a4.G.E(a22, a32, n3, a4.a);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, n2);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a32 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, a4.j - a22.getHeight() - 5);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, n3);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a32, a22.getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(a22), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)a32, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }
}

