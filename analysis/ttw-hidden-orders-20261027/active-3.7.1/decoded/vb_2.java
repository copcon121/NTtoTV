/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.vb
 */
public class vb_2
implements ActionListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ ob_1 b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vb_2(ob_1 a2, JComboBox a3, df_0 a4, ze_2 a5, sc_1 a6) {
        vb_2 a7;
        vb_2 vb_22 = a7;
        a7.b = a2;
        vb_22.c = a3;
        vb_22.A = a4;
        a7.C = a5;
        a7.M = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        vb_2 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ua_0)a3.A.M).D) {
            vb_2 vb_22;
            boolean bl;
            vb_2 vb_23;
            ((ua_0)a3.A.M).D = a2;
            a3.b.E().E(a3.b.E().f(), a3.C.M, a3.A);
            if (a2 == df_1.c) {
                a2 = a3.b.M;
                synchronized (a2) {
                    if (a3.b.C.containsKey(a3.C.M)) {
                        JDialog jDialog = a3.b.C.remove(a3.C.M);
                        jDialog.setVisible(false);
                        jDialog.dispose();
                    }
                    // MONITOREXIT @DISABLED, blocks:[0, 1, 7, 8] lbl13 : MonitorExitStatement: MONITOREXIT : a /* !! */ 
                    vb_23 = a3;
                }
            } else {
                vb_23 = a3;
            }
            vb_23.A.E(pf_0.Y);
            vb_2 vb_24 = a3;
            if (((ua_0)vb_24.A.M).D != df_1.c) {
                bl = true;
                vb_22 = a3;
            } else {
                bl = false;
                vb_22 = a3;
            }
            vb_24.M.E(bl, vb_22.b.c);
        }
    }
}

