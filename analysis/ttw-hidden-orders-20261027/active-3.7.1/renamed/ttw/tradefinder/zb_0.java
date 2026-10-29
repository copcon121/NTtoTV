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
import ttw.tradefinder.ea_1;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.gc_0;
import ttw.tradefinder.if_0;
import ttw.tradefinder.n;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tb_0;
import velox.colors.ColorsChangedListener;

/*
 * Renamed from ttw.tradefinder.ZB
 */
public class zb_0
implements n {
    public final /* synthetic */ String A;
    public final /* synthetic */ String C;
    public final /* synthetic */ JLabel M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ea_1 c;

    @Override
    public void E(eb_1 a2) {
        zb_0 a3;
        if (((tb_0)a3.b.M).c.equals((Object)a2)) {
            return;
        }
        ((tb_0)a3.b.M).c = a2;
        zb_0 zb_02 = a3;
        zb_0 zb_03 = a3;
        a3.c.ttw_tradefinder_f_0_E().E(a3.c.M.f(), zb_02.A, zb_03.C, zb_03.b);
        zb_02.c.l(a3.A);
    }

    @Override
    public Color a() {
        zb_0 a2;
        zb_0 zb_02 = a2;
        return zb_02.c.getColor(zb_02.A, a2.c.M.g());
    }

    @Override
    public void E(int a2) {
        zb_0 a3;
        if (((tb_0)a3.b.M).b == a2) {
            return;
        }
        ((tb_0)a3.b.M).b = a2;
        zb_0 zb_02 = a3;
        zb_0 zb_03 = a3;
        a3.c.ttw_tradefinder_f_0_E().E(a3.c.M.f(), zb_02.A, zb_03.C, zb_03.b);
        zb_02.c.l(a3.A);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ zb_0(ea_1 a2, String a3, df_0 a4, String a5, JLabel a6) {
        zb_0 a7;
        zb_0 zb_02 = a7;
        a7.c = a2;
        zb_02.A = a3;
        zb_02.b = a4;
        a7.C = a5;
        a7.M = a6;
    }

    @Override
    public void E(Graphics2D a2, int a3, int a4, int a5, int a6) {
        zb_0 a7;
        zb_0 zb_02 = a7;
        zb_0 zb_03 = a7;
        zb_02.M.setIcon(zb_02.c.E(zb_03.A, (tb_0)zb_03.b.M));
        gc_0.E(a2, a3, a4, a5, a6, a7.j(), new tb_0(a7.int_E(), a7.ttw_tradefinder_eb_1_E()));
    }

    @Override
    public eb_1 ttw_tradefinder_eb_1_E() {
        zb_0 a2;
        return ((tb_0)a2.b.M).c;
    }

    @Override
    public Color java_awt_Color_E() {
        zb_0 a2;
        zb_0 zb_02 = a2;
        return zb_02.c.getColor(zb_02.A, a2.c.M.java_lang_String_a());
    }

    @Override
    public void E(sc_1 a2, ColorsChangedListener a3) {
        zb_0 a4;
        zb_0 zb_02 = a4;
        a2.E(new JLabel(if_0.E("X:w:i")), (Component)zb_02.c.E(zb_02.A, a4.c.M.java_lang_String_d(), a3));
    }

    @Override
    public Color j() {
        zb_0 a2;
        zb_0 zb_02 = a2;
        return zb_02.c.getColor(zb_02.A, a2.c.M.java_lang_String_d());
    }

    @Override
    public int int_E() {
        zb_0 a2;
        return ((tb_0)a2.b.M).b;
    }
}

