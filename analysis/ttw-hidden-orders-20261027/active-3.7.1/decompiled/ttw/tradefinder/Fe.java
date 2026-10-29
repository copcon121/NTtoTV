/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Ob;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class Fe
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ lg c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        Fe a3;
        if (a3.C.isSelected() != ((Ob)a3.b.M).M) {
            ((Ob)a3.b.M).M = a3.C.isSelected();
            Fe fe = a3;
            fe.M.E(((Ob)fe.b.M).M);
            Fe fe2 = a3;
            a3.c.E().E(ra_1.E("\u0006 \u0005Y\u001f\u0015 \u001f7\u0000\u0017\f\"\u0018=\u00067\u0006"), fe2.A.M, a3.b);
            fe2.b.E(pf_0.n);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Fe(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        Fe a7;
        Fe fe = a7;
        a7.c = a2;
        fe.C = a3;
        fe.b = a4;
        a7.M = a5;
        a7.A = a6;
    }
}

