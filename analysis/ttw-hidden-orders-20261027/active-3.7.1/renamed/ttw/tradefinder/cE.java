/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ra_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class cE
implements ItemListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JCheckBox b;
    public final /* synthetic */ dE c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        cE a3;
        if (a3.b.isSelected() != ((ra_0)a3.A.M).c) {
            ((ra_0)a3.A.M).c = a3.b.isSelected();
            cE cE2 = a3;
            cE2.C.E(((ra_0)cE2.A.M).c);
            cE cE3 = a3;
            a3.c.ttw_tradefinder_f_0_E().E(ff_0.E("2\u00111h.,\u0002!\u0003+)7\u0002 \u00146"), cE3.M.M, a3.A);
            cE3.A.E(pf_0.h);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cE(dE a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        cE a7;
        cE cE2 = a7;
        a7.c = a2;
        cE2.b = a3;
        cE2.A = a4;
        a7.C = a5;
        a7.M = a6;
    }
}

