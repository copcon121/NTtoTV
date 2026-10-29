/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class ef
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ dE b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ef(dE a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        ef a7;
        ef ef2 = a7;
        a7.b = a2;
        ef2.C = a3;
        ef2.c = a4;
        a7.M = a5;
        a7.A = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        ef a3;
        if (a3.C.isSelected() != ((za_0)a3.c.M).j) {
            ((za_0)a3.c.M).j = a3.C.isSelected();
            ef ef2 = a3;
            ef2.M.E(((za_0)ef2.c.M).j);
            ef ef3 = a3;
            a3.b.E().E(bb_2.E("\t\u0001\nx\u0015<918;\u0012'90/&"), ef3.A.M, a3.c);
            ef3.c.E(pf_0.a);
        }
    }
}

