/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import javax.swing.ImageIcon;
import javax.swing.JLabel;
import ttw.tradefinder.ab_0;
import ttw.tradefinder.c_0;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.hd;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.ua_1;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.z;
import ttw.tradefinder.za_1;

public class AB
implements z {
    public final /* synthetic */ JLabel A;
    public final /* synthetic */ String C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ ua_1 c;

    @Override
    public void a(int a2) {
        AB a3;
        if (((ca_1)a3.M.M).D == a2) {
            return;
        }
        ((ca_1)a3.M.M).D = a2;
        a3.void_E();
    }

    @Override
    public int int_E() {
        AB a2;
        return ((ca_1)a2.M.M).D;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ AB(ua_1 a2, String a3, String a4, df_0 a5, JLabel a6) {
        AB a7;
        AB aB = a7;
        a7.c = a2;
        aB.b = a3;
        aB.C = a4;
        a7.M = a5;
        a7.A = a6;
    }

    @Override
    public yb_0 ttw_tradefinder_yb_0_E() {
        AB a2;
        return ((ca_1)a2.M.M).b;
    }

    private /* synthetic */ void void_E() {
        AB a2;
        AB aB = a2;
        AB aB2 = a2;
        a2.c.ttw_tradefinder_f_0_E().E(a2.c.ttw_tradefinder_r_0_E().f(), aB.b, aB2.C, aB2.M);
        aB.A.setIcon(new ImageIcon(cb_0.E((ca_1)a2.M.M)));
        AB aB3 = a2;
        c_0 c_02 = aB3.c.ttw_tradefinder_c_0_E(aB3.b);
        if (c_02 == null || !(c_02 instanceof ab_0)) {
            return;
        }
        ((ab_0)c_02).void_E(false);
    }

    @Override
    public void E(int a2) {
        AB a3;
        if (((ca_1)a3.M.M).H == a2) {
            return;
        }
        ((ca_1)a3.M.M).H = a2;
        a3.void_E();
    }

    @Override
    public boolean boolean_j() {
        AB a2;
        return a2.c.c;
    }

    @Override
    public boolean boolean_E() {
        AB a2;
        return a2.c.b;
    }

    @Override
    public Color java_awt_Color_j() {
        AB a2;
        return ((ca_1)a2.M.M).a;
    }

    @Override
    public void E(Color a2) {
        AB a3;
        if (((ca_1)a3.M.M).a.equals(a2)) {
            return;
        }
        ((ca_1)a3.M.M).a = a2;
        a3.void_E();
    }

    @Override
    public Color java_awt_Color_E() {
        AB a2;
        return ((ca_1)a2.M.M).A;
    }

    @Override
    public void j(Color a2) {
        AB a3;
        if (((ca_1)a3.M.M).C.equals(a2)) {
            return;
        }
        ((ca_1)a3.M.M).C = a2;
        a3.void_E();
    }

    @Override
    public za_1 ttw_tradefinder_za_1_E() {
        AB a2;
        return ((ca_1)a2.M.M).c;
    }

    @Override
    public void E(za_1 a2) {
        AB a3;
        if (((ca_1)a3.M.M).c.equals((Object)a2)) {
            return;
        }
        ((ca_1)a3.M.M).c = a2;
        a3.void_E();
    }

    @Override
    public void E(qc_0 a2) {
        AB a3;
        if (((ca_1)a3.M.M).M.equals((Object)a2)) {
            return;
        }
        ((ca_1)a3.M.M).M = a2;
        a3.void_E();
    }

    @Override
    public void a(Color a2) {
        AB a3;
        if (((ca_1)a3.M.M).A.equals(a2)) {
            return;
        }
        ((ca_1)a3.M.M).A = a2;
        a3.void_E();
    }

    @Override
    public int int_j() {
        AB a2;
        return ((ca_1)a2.M.M).j;
    }

    @Override
    public void E(yb_0 a2) {
        AB a3;
        if (((ca_1)a3.M.M).b.equals((Object)a2)) {
            return;
        }
        ((ca_1)a3.M.M).b = a2;
        a3.void_E();
    }

    @Override
    public Color java_awt_Color_a() {
        AB a2;
        return ((ca_1)a2.M.M).C;
    }

    @Override
    public void E(hd a2) {
        AB a3;
        if (((ca_1)a3.M.M).h.equals((Object)a2)) {
            return;
        }
        ((ca_1)a3.M.M).h = a2;
        a3.void_E();
    }

    @Override
    public void j(int a2) {
        AB a3;
        if (((ca_1)a3.M.M).j == a2) {
            return;
        }
        ((ca_1)a3.M.M).j = a2;
        a3.void_E();
    }

    @Override
    public hd ttw_tradefinder_hd_E() {
        AB a2;
        return ((ca_1)a2.M.M).h;
    }

    @Override
    public int int_a() {
        AB a2;
        return ((ca_1)a2.M.M).H;
    }

    @Override
    public qc_0 ttw_tradefinder_qc_0_E() {
        AB a2;
        return ((ca_1)a2.M.M).M;
    }
}

