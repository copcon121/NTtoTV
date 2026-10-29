/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class WE
implements ItemListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ gd_0 C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ WE(gd_0 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        WE a7;
        WE wE = a7;
        a7.C = a2;
        wE.b = a3;
        wE.A = a4;
        a7.M = a5;
        a7.c = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        WE a3;
        if (a3.b.isSelected() != ((Oa)a3.A.M).j) {
            ((Oa)a3.A.M).j = a3.b.isSelected();
            WE wE = a3;
            wE.M.E(((Oa)wE.A.M).j);
            WE wE2 = a3;
            a3.C.ttw_tradefinder_f_0_E().E(gc_1.E("f6eO~\u000bC\u0017[\u0006[\u0016K6@\u0003Q\tW\u0010"), wE2.c.M, a3.A);
            wE2.A.E(pf_0.j);
        }
    }
}

