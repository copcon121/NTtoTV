/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import javax.swing.JDialog;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.sA
 */
public class sa_2
implements ItemListener {
    public final /* synthetic */ sc_1 A;
    public final /* synthetic */ ob_1 C;
    public final /* synthetic */ JCheckBox M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ sa_2(ob_1 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        sa_2 a7;
        sa_2 sa_22 = a7;
        a7.C = a2;
        sa_22.M = a3;
        sa_22.b = a4;
        a7.A = a5;
        a7.c = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        sa_2 a3;
        if (a3.M.isSelected() != ((ua_0)a3.b.M).j) {
            ((ua_0)a3.b.M).j = a3.M.isSelected();
            sa_2 sa_22 = a3;
            sa_22.A.E(((ua_0)sa_22.b.M).j);
            sa_2 sa_23 = a3;
            sa_2 sa_24 = a3;
            sa_23.C.E().E(sa_24.C.E().f(), a3.c.M, a3.b);
            sa_23.b.E(pf_0.L);
            if (!((ua_0)sa_24.b.M).j) {
                a2 = a3.C.M;
                synchronized (a2) {
                    if (a3.C.C.containsKey(a3.c.M)) {
                        JDialog jDialog = a3.C.C.get(a3.c.M);
                        jDialog.setVisible(false);
                    }
                    return;
                }
            }
        }
    }
}

