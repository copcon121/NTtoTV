/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class Jg
implements ItemListener {
    public final /* synthetic */ sc_1 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        Jg a3;
        if (a3.C.isSelected() != ((sa_0)a3.M.M).c) {
            ((sa_0)a3.M.M).c = a3.C.isSelected();
            Jg jg = a3;
            jg.A.E(((sa_0)jg.M.M).c);
            Jg jg2 = a3;
            a3.b.E().E("TTW-MarketExplorer", jg2.c.M, a3.M);
            jg2.M.E(pf_0.f);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Jg(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        Jg a7;
        Jg jg = a7;
        a7.b = a2;
        jg.C = a3;
        jg.M = a4;
        a7.A = a5;
        a7.c = a6;
    }
}

