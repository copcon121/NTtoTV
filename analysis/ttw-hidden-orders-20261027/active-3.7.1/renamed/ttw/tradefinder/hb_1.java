/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.a;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.jc_0;
import ttw.tradefinder.kb_2;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Hb
 */
public class hb_1
extends kb_2 {
    private final df_0<ib_0, a> M;
    private double b;
    private final ff_1 c;

    @Override
    public void E(ff_1 a2) {
        hb_1 a3;
        if (a2 != a3.c) {
            return;
        }
        a3.void_E(true);
    }

    @Override
    public Pair<BufferedImage, Integer> E(jc_0 a222) {
        hb_1 a3;
        int a222 = (int)Math.min(10.0 / a3.b * a222.double_E(), 10.0);
        BufferedImage a222 = gc_1.E((ib_0)a3.M.M, a222);
        return Pair.of((Object)a222, (Object)gc_1.E(((ib_0)a3.M.M).b, a222.getHeight()));
    }

    public hb_1(f_0 a2, ze_2 a3, df_0<ib_0, a> a4, ff_1 a5, s_0 a6) {
        hb_1 a7;
        hb_1 hb_12 = a7;
        super(a2, a3, a6);
        a7.b = 0.0;
        hb_12.c = a5;
        hb_12.M = a4;
    }

    @Override
    public void E(ff_1 a2, double a3, long a4) {
        hb_1 a5;
        if (a2 == a5.c) {
            double d2;
            hb_1 hb_12 = a5;
            hb_12.j(new jc_0(a3), a4);
            a3 = Math.max(hb_12.b, a3 * 0.7);
            if (d2 > a5.b) {
                a5.b = a3;
                a5.void_E(false);
            }
        }
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        hb_1 a5;
        if (a2 != a5.c) {
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
}

