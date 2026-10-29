/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
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

import java.awt.Color;
import java.awt.image.BufferedImage;
import ttw.tradefinder.W;
import ttw.tradefinder.c_0;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.hJ;
import ttw.tradefinder.l_0;
import ttw.tradefinder.o_0;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pe_2;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.rC;
import ttw.tradefinder.r_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.zc_1;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;

/*
 * Renamed from ttw.tradefinder.aB
 */
public class ab_0
extends xb_2
implements c_0,
o_0,
W {
    private final zc_1 B;
    private final Object K;
    private final df_0<ca_1, hJ> E;
    private final ff_1 j;
    private static final int a = 40000;
    private static final long h = cd_2.M;
    private final rC H;
    private final ge_1 D;
    private static final int A = 2000000;
    private final zc_1 C;
    private ee_1 M;
    private final ge_1 b;
    private final zc_1 c;

    @Override
    public void E(long a222, long a3) {
        ab_0 a4;
        Object object = a4.K;
        synchronized (object) {
            Object object2;
            int n2;
            int n3 = ((ca_1)a4.E.M).b == yb_0.c ? ((ca_1)a4.E.M).j : ((ca_1)a4.E.M).H;
            int n4 = n2 = ((ca_1)a4.E.M).b == yb_0.c ? ((ca_1)a4.E.M).j : ((ca_1)a4.E.M).D;
            if (a222 >= a3) {
                return;
            }
            if (((ca_1)a4.E.M).M == qc_0.M) {
                ab_0 ab_02 = a4;
                a4.b.A();
                ab_02.D.A();
                long l2 = Math.max(1L, (a3 - a222) / (long)cb_0.c);
                long l3 = a222 / l2 * l2;
                double d2 = (double)(a222 - l3) / (double)l2;
                long l4 = l3 + l2;
                if (((ca_1)ab_02.E.M).b == yb_0.M) {
                    long l5 = 1L;
                    long l6 = -1L;
                    long l7 = 0L;
                    long l8 = 0L;
                    int a222 = a4.M.j(l3);
                    if (a222 != -1) {
                        long l9;
                        int n5 = a222 = a222;
                        while (n5 < a4.M.int_E() && (l9 = a4.M.long_E(a222)) <= a3) {
                            pe_2 pe_22 = a4.M.ttw_tradefinder_pe_2_E(a222);
                            long l10 = l9;
                            while (l10 > l4) {
                                l4 += l2;
                                l5 = Math.max(l5, l7);
                                l6 = Math.min(l6, l8);
                                ab_0 ab_03 = a4;
                                ab_03.b.E(l7);
                                ab_03.D.E(l8);
                                l7 = 0L;
                                l8 = 0L;
                                l10 = l9;
                            }
                            if (pe_22.b) {
                                l8 -= (long)pe_22.c;
                            } else {
                                l7 += (long)pe_22.c;
                            }
                            n5 = ++a222;
                        }
                    }
                    long l11 = l4;
                    while (l11 <= a3 + l2) {
                        l4 += l2;
                        ab_0 ab_04 = a4;
                        ab_04.b.E(l7);
                        ab_04.D.E(l8);
                        l7 = 0L;
                        l8 = 0L;
                        l11 = l4;
                    }
                    BufferedImage a222 = cb_0.E((ca_1)a4.E.M, l5, a4.b, d2);
                    ab_0 ab_05 = a4;
                    a4.H.E(ab_05.E(a222, ((ca_1)ab_05.E.M).H, l3, a3));
                    ab_0 ab_06 = a4;
                    a4.H.E(ab_06.E(((ca_1)ab_06.E.M).H, a4.B));
                    BufferedImage bufferedImage = cb_0.E((ca_1)a4.E.M, l6, a4.D, d2);
                    ab_0 ab_07 = a4;
                    a4.H.E(ab_07.E(bufferedImage, ((ca_1)ab_07.E.M).D, l3, a3));
                    ab_0 ab_08 = a4;
                    a4.H.E(ab_08.E(((ca_1)ab_08.E.M).D, a4.C));
                    object2 = object;
                } else {
                    long l12 = 1L;
                    long l13 = 0L;
                    int n6 = a4.M.j(l3);
                    if (n6 != -1) {
                        long l14;
                        int n7;
                        int n8 = n7 = n6;
                        while (n8 < a4.M.int_E() && (l14 = a4.M.long_E(n7)) <= a3) {
                            pe_2 a222 = a4.M.ttw_tradefinder_pe_2_E(n7);
                            long l15 = l14;
                            while (l15 > l4) {
                                l4 += l2;
                                l12 = Math.max(l12, Math.abs(l13));
                                a4.b.E(l13);
                                l13 = 0L;
                                l15 = l14;
                            }
                            pe_2 pe_23 = a222;
                            l13 += (long)(a222.b ? -pe_23.c : pe_23.c);
                            n8 = ++n7;
                        }
                    }
                    long l16 = l4;
                    while (l16 <= a3 + l2) {
                        l12 = Math.max(l12, Math.abs(l13));
                        a4.b.E(l13);
                        l13 = 0L;
                        l16 = l4 += l2;
                    }
                    BufferedImage bufferedImage = cb_0.E((ca_1)a4.E.M, l12, a4.b, d2);
                    ab_0 ab_09 = a4;
                    a4.H.E(ab_09.E(bufferedImage, ((ca_1)ab_09.E.M).j, l3, a3));
                    ab_0 ab_010 = a4;
                    a4.H.E(ab_010.E(((ca_1)ab_010.E.M).j, a4.c));
                    object2 = object;
                }
            } else {
                int n9;
                int n10;
                int n11;
                int n12;
                int n13;
                int n14;
                block28: {
                    long a222;
                    n14 = a4.M.j(a222);
                    if (n14 == -1) {
                        return;
                    }
                    n13 = 1;
                    n12 = 1;
                    int n15 = n11 = n14;
                    while (n15 < a4.M.int_E()) {
                        if (a4.M.long_E(n11) > a3) {
                            n10 = n13;
                            --n11;
                            break block28;
                        }
                        pe_2 pe_24 = a4.M.ttw_tradefinder_pe_2_E(n11);
                        if (pe_24.b) {
                            n12 = Math.max(n12, pe_24.c);
                        } else {
                            n13 = Math.max(n13, pe_24.c);
                        }
                        n15 = ++n11;
                    }
                    n10 = n13;
                }
                n13 = (int)((double)n10 * 0.7);
                n12 = (int)((double)n12 * 0.7);
                int n16 = n9 = n14;
                while (n16 < n11) {
                    pe_2 pe_25 = a4.M.ttw_tradefinder_pe_2_E(n9);
                    ab_0 ab_011 = a4;
                    if (pe_25.b) {
                        ab_011.H.E(a4.E(pe_25, n12, n2, ((ca_1)a4.E.M).A, a4.M.long_E(n9)));
                    } else {
                        ab_011.H.E(a4.E(pe_25, n13, n3, ((ca_1)a4.E.M).a, a4.M.long_E(n9)));
                    }
                    n16 = ++n9;
                }
                if (n3 == n2) {
                    object2 = object;
                    ab_0 ab_012 = a4;
                    a4.H.E(ab_012.E(n3, ab_012.c));
                } else {
                    ab_0 ab_013 = a4;
                    ab_0 ab_014 = a4;
                    ab_013.H.E(ab_014.E(n3, ab_014.B));
                    ab_0 ab_015 = a4;
                    ab_013.H.E(ab_015.E(n2, ab_015.C));
                    object2 = object;
                }
            }
            // ** MonitorExit[v11] (shouldn't be in output)
            return;
        }
    }

    public ab_0(f_0 a2, ze_2 a3, r_0 a4, s_0 a5) {
        ab_0 a6;
        ab_0 ab_02 = a6;
        ab_0 ab_03 = a6;
        super(a2, a3, a5);
        a6.K = new Object();
        a6.b = new ge_1(cb_0.c << 1);
        a6.D = new ge_1(cb_0.c << 1);
        a6.M = new ee_1(h, 40000, 2000000, true);
        a6.H = new rC(a6);
        ab_03.j = a4.ttw_tradefinder_ff_1_E();
        ab_03.E = a2.E(a4.f(), a3.M, a4.java_lang_String_d(), a4.ttw_tradefinder_ca_1_E());
        ab_02.c = new zc_1(a4.java_lang_String_d());
        ab_02.B = new zc_1(a4.java_lang_String_d() + " ASK");
        a6.C = new zc_1(a4.java_lang_String_d() + " BID");
    }

    @Override
    public boolean boolean_E() {
        ab_0 a2;
        return a2.H.boolean_E();
    }

    @Override
    public void void_j(long a2) {
        ab_0 a3;
        a3.H.a();
    }

    @Override
    public l_0 ttw_tradefinder_l_0_E() {
        ab_0 a2;
        return a2.H;
    }

    public ScreenSpaceCanvas.CanvasIcon E(BufferedImage a2, int a32, long a42, long a52) {
        ab_0 a6;
        a32 = cb_0.E(a32, a2.getHeight(), a6.H.int_E());
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate a42 = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, a42);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, a52);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a32 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, a32);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a52 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a32, a2.getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(a2), (ScreenSpaceCanvas.HorizontalCoordinate)a42, (ScreenSpaceCanvas.VerticalCoordinate)a32, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)a52);
    }

    @Override
    public void E(ff_1 a2) {
        ab_0 a3;
        if (a2 != a3.j) {
            return;
        }
        a3.void_E(true);
    }

    public ScreenSpaceCanvas.CanvasIcon E(int a22, zc_1 a3) {
        ab_0 a4;
        a3 = cb_0.E((zc_1)a3);
        a22 = cb_0.E(a22, ((BufferedImage)a3).getHeight(), a4.H.int_E());
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_PIXEL_ZERO, 10);
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate relativePixelHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, ((BufferedImage)a3).getWidth());
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a22 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, a22);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a22, ((BufferedImage)a3).getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage((BufferedImage)a3), (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)a22, (ScreenSpaceCanvas.HorizontalCoordinate)relativePixelHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate);
    }

    @Override
    public void void_j() {
        ab_0 a2;
        ab_0 ab_02 = a2;
        super.void_j();
        ab_02.void_E(true);
        ab_02.H.void_E();
    }

    @Override
    public void void_E(boolean a22) {
        ab_0 ab_02;
        ab_0 a3;
        if (a22) {
            Object a22 = a3.K;
            synchronized (a22) {
                a3.M.a();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : a
                ab_02 = a3;
            }
        } else {
            ab_02 = a3;
        }
        ab_02.H.a();
    }

    @Override
    public void E(ff_1 a2, int a3, boolean a4, long a5) {
        ab_0 a6;
        if (a2 != a6.j) {
            return;
        }
        a2 = a6.K;
        synchronized (a2) {
            a6.M.E(a5, a4, Math.abs(a3));
            return;
        }
    }

    public void a(boolean a2) {
        ab_0 a3;
        if (a3.H.boolean_E() == a2) {
            return;
        }
        ab_0 ab_02 = a3;
        boolean bl = a2;
        ab_02.H.E(bl);
        ab_02.j(bl);
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        ab_0 a5;
        if (a2 != a5.j) {
            return;
        }
        if (a3 == oe_1.M) {
            a5.a(a4);
            return;
        }
        if (a3 == oe_1.b && a4) {
            a5.void_E(false);
        }
    }

    public ScreenSpaceCanvas.CanvasIcon E(pe_2 a222, int a32, int a42, Color a5, long a62) {
        ab_0 a7;
        int a222 = (int)Math.min(10.0 / (double)a32 * (double)a222.c, 10.0);
        BufferedImage a222 = cb_0.E((ca_1)a7.E.M, a222, a5);
        a32 = cb_0.E(a42, a222.getHeight(), a7.H.int_E());
        ScreenSpaceCanvas.RelativePixelHorizontalCoordinate a42 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeHorizontalCoordinate.HORIZONTAL_DATA_ZERO, a62), -(a222.getWidth() / 2));
        a5 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)a42, a222.getWidth());
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a32 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeVerticalCoordinate.VERTICAL_PIXEL_ZERO, a32);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate a62 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)a32, a222.getHeight());
        return new ScreenSpaceCanvas.CanvasIcon(new ScreenSpaceCanvas.PreparedImage(a222), (ScreenSpaceCanvas.HorizontalCoordinate)a42, (ScreenSpaceCanvas.VerticalCoordinate)a32, (ScreenSpaceCanvas.HorizontalCoordinate)a5, (ScreenSpaceCanvas.VerticalCoordinate)a62);
    }
}

