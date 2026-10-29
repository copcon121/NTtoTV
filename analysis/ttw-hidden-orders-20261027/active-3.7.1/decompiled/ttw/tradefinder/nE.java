/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.if_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ra;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class nE
implements ItemListener {
    public final /* synthetic */ lg A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        nE a3;
        if (a3.C.isSelected() != ((ra)a3.c.M).A) {
            ((ra)a3.c.M).A = a3.C.isSelected();
            nE nE2 = a3;
            nE2.b.E(((ra)nE2.c.M).A);
            nE nE3 = a3;
            a3.A.E().E(if_0.E("\u0001O\u00026\u0018z'p0o\u0010c%w:i0i"), nE3.M.M, a3.c);
            nE3.c.E(pf_0.R);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nE(lg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        nE a7;
        nE nE2 = a7;
        a7.A = a2;
        nE2.C = a3;
        nE2.c = a4;
        a7.b = a5;
        a7.M = a6;
    }
}

