/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.bf_0;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class gf
implements ItemListener {
    public final /* synthetic */ dE A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ JCheckBox c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        gf a3;
        if (a3.c.isSelected() != ((za_0)a3.b.M).M) {
            ((za_0)a3.b.M).M = a3.c.isSelected();
            gf gf2 = a3;
            gf2.C.E(((za_0)gf2.b.M).M);
            gf gf3 = a3;
            a3.A.E().E(bf_0.E("1h2\u0011-U\u0001X\u0000R*N\u0001Y\u0017O"), gf3.M.M, a3.b);
            gf3.b.E(pf_0.u);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ gf(dE a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        gf a7;
        gf gf2 = a7;
        a7.A = a2;
        gf2.c = a3;
        gf2.b = a4;
        a7.C = a5;
        a7.M = a6;
    }
}

