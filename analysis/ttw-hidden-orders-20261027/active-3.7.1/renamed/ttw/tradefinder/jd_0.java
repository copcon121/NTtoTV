/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import javax.swing.ImageIcon;
import javax.swing.JLabel;
import ttw.tradefinder.Ad;
import ttw.tradefinder.P;
import ttw.tradefinder.c_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.hb_1;
import ttw.tradefinder.hd;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.yc_1;
import ttw.tradefinder.za_1;

/*
 * Renamed from ttw.tradefinder.jd
 */
public class jd_0
implements P {
    public final /* synthetic */ String A;
    public final /* synthetic */ JLabel C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ yc_1 b;
    public final /* synthetic */ String c;

    @Override
    public Ad ttw_tradefinder_Ad_E() {
        jd_0 a2;
        return ((ib_0)a2.M.M).M;
    }

    @Override
    public void E(Ad a2) {
        jd_0 a3;
        ((ib_0)a3.M.M).M = a2;
        jd_0 jd_02 = a3;
        jd_0 jd_03 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.ttw_tradefinder_r_0_E().f(), jd_02.c, jd_03.A, jd_03.M);
        jd_02.C.setIcon(new ImageIcon(gc_1.E((ib_0)a3.M.M, 10)));
        jd_0 jd_04 = a3;
        a2 = jd_04.b.ttw_tradefinder_c_0_E(jd_04.c);
        if (a2 == null || !(a2 instanceof hb_1)) {
            return;
        }
        ((hb_1)a2).void_E(false);
    }

    @Override
    public void E(hd a2) {
        jd_0 a3;
        ((ib_0)a3.M.M).A = a2;
        jd_0 jd_02 = a3;
        jd_0 jd_03 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.ttw_tradefinder_r_0_E().f(), jd_02.c, jd_03.A, jd_03.M);
        jd_02.C.setIcon(new ImageIcon(gc_1.E((ib_0)a3.M.M, 10)));
        jd_0 jd_04 = a3;
        a2 = jd_04.b.ttw_tradefinder_c_0_E(jd_04.c);
        if (a2 == null || !(a2 instanceof hb_1)) {
            return;
        }
        ((hb_1)a2).void_E(false);
    }

    @Override
    public int int_E() {
        jd_0 a2;
        return ((ib_0)a2.M.M).b;
    }

    @Override
    public hd ttw_tradefinder_hd_E() {
        jd_0 a2;
        return ((ib_0)a2.M.M).A;
    }

    @Override
    public za_1 ttw_tradefinder_za_1_E() {
        jd_0 a2;
        return ((ib_0)a2.M.M).c;
    }

    @Override
    public void E(int a22) {
        jd_0 a3;
        ((ib_0)a3.M.M).b = a22;
        jd_0 jd_02 = a3;
        jd_0 jd_03 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.ttw_tradefinder_r_0_E().f(), jd_02.c, jd_03.A, jd_03.M);
        jd_02.C.setIcon(new ImageIcon(gc_1.E((ib_0)a3.M.M, 10)));
        jd_0 jd_04 = a3;
        c_0 a22 = jd_04.b.ttw_tradefinder_c_0_E(jd_04.c);
        if (a22 == null || !(a22 instanceof hb_1)) {
            return;
        }
        ((hb_1)a22).void_E(false);
    }

    @Override
    public void E(Color a2) {
        jd_0 a3;
        if (!((ib_0)a3.M.M).C.equals(a2)) {
            ((ib_0)a3.M.M).C = a2;
            jd_0 jd_02 = a3;
            jd_0 jd_03 = a3;
            a3.b.ttw_tradefinder_f_0_E().E(a3.b.ttw_tradefinder_r_0_E().f(), jd_02.c, jd_03.A, jd_03.M);
            jd_02.C.setIcon(new ImageIcon(gc_1.E((ib_0)a3.M.M, 10)));
            jd_0 jd_04 = a3;
            a2 = jd_04.b.ttw_tradefinder_c_0_E(jd_04.c);
            if (a2 == null || !(a2 instanceof hb_1)) {
                return;
            }
            ((hb_1)a2).void_E(false);
        }
    }

    @Override
    public void E(za_1 a2) {
        jd_0 a3;
        ((ib_0)a3.M.M).c = a2;
        jd_0 jd_02 = a3;
        jd_0 jd_03 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.ttw_tradefinder_r_0_E().f(), jd_02.c, jd_03.A, jd_03.M);
        jd_02.C.setIcon(new ImageIcon(gc_1.E((ib_0)a3.M.M, 10)));
        jd_0 jd_04 = a3;
        a2 = jd_04.b.ttw_tradefinder_c_0_E(jd_04.c);
        if (a2 == null || !(a2 instanceof hb_1)) {
            return;
        }
        ((hb_1)a2).void_E(false);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ jd_0(yc_1 a2, df_0 a3, String a4, String a5, JLabel a6) {
        jd_0 a7;
        jd_0 jd_02 = a7;
        a7.b = a2;
        jd_02.M = a3;
        jd_02.c = a4;
        a7.A = a5;
        a7.C = a6;
    }

    @Override
    public Color java_awt_Color_E() {
        jd_0 a2;
        return ((ib_0)a2.M.M).C;
    }
}

