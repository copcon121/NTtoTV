/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.colors.ColorsChangedListener
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics2D;
import javax.swing.JLabel;
import ttw.tradefinder.df_0;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.gc_0;
import ttw.tradefinder.n;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.zb_1;
import velox.colors.ColorsChangedListener;

/*
 * Renamed from ttw.tradefinder.vB
 */
public class vb_1
implements n {
    public final /* synthetic */ JLabel A;
    public final /* synthetic */ String C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ zb_1 b;
    public final /* synthetic */ String c;

    @Override
    public void E(eb_1 a2) {
        vb_1 a3;
        if (((tb_0)a3.M.M).c.equals((Object)a2)) {
            return;
        }
        ((tb_0)a3.M.M).c = a2;
        vb_1 vb_12 = a3;
        vb_1 vb_13 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.M.f(), vb_12.C, vb_13.c, vb_13.M);
        vb_12.b.l(a3.C);
    }

    @Override
    public int int_E() {
        vb_1 a2;
        return ((tb_0)a2.M.M).b;
    }

    @Override
    public void E(sc_1 a2, ColorsChangedListener a3) {
        vb_1 a4;
        vb_1 vb_12 = a4;
        a2.E(new JLabel(a4.b.M.l()), (Component)vb_12.b.E(vb_12.C, a4.b.M.g(), a3));
        vb_1 vb_13 = a4;
        a2.E(new JLabel(a4.b.M.C()), (Component)vb_13.b.E(vb_13.C, a4.b.M.java_lang_String_a(), a3));
        vb_1 vb_14 = a4;
        a2.E(new JLabel(a4.b.M.H()), (Component)vb_14.b.E(vb_14.C, a4.b.M.java_lang_String_j(), a3));
    }

    @Override
    public Color j() {
        vb_1 a2;
        vb_1 vb_12 = a2;
        return vb_12.b.getColor(vb_12.C, a2.b.M.java_lang_String_d());
    }

    @Override
    public void E(int a2) {
        vb_1 a3;
        if (((tb_0)a3.M.M).b == a2) {
            return;
        }
        ((tb_0)a3.M.M).b = a2;
        vb_1 vb_12 = a3;
        vb_1 vb_13 = a3;
        a3.b.ttw_tradefinder_f_0_E().E(a3.b.M.f(), vb_12.C, vb_13.c, vb_13.M);
        vb_12.b.l(a3.C);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vb_1(zb_1 a2, String a3, df_0 a4, String a5, JLabel a6) {
        vb_1 a7;
        vb_1 vb_12 = a7;
        a7.b = a2;
        vb_12.C = a3;
        vb_12.M = a4;
        a7.c = a5;
        a7.A = a6;
    }

    @Override
    public eb_1 ttw_tradefinder_eb_1_E() {
        vb_1 a2;
        return ((tb_0)a2.M.M).c;
    }

    @Override
    public void E(Graphics2D a2, int a3, int a4, int a5, int a6) {
        vb_1 a7;
        vb_1 vb_12 = a7;
        vb_1 vb_13 = a7;
        vb_12.A.setIcon(vb_12.b.E(vb_13.C, (tb_0)vb_13.M.M));
        gc_0.j(a2, a3, a4, a5, a6, a7.a(), a7.java_awt_Color_E(), new tb_0(a7.int_E(), a7.ttw_tradefinder_eb_1_E()));
    }

    @Override
    public Color java_awt_Color_E() {
        vb_1 a2;
        vb_1 vb_12 = a2;
        return vb_12.b.getColor(vb_12.C, a2.b.M.java_lang_String_a());
    }

    @Override
    public Color a() {
        vb_1 a2;
        vb_1 vb_12 = a2;
        return vb_12.b.getColor(vb_12.C, a2.b.M.g());
    }
}

