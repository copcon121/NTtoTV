/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.la_2;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.IB
 */
public class ib_1
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ la_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        ib_1 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), mb_2.C);
        if (a2 != ((dc_2)a3.C.M).b) {
            ((dc_2)a3.C.M).b = a2;
            ib_1 ib_12 = a3;
            a3.c.E().E(a3.c.E().f(), ib_12.b.M, a3.C);
            ib_12.C.E(pf_0.Z);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ib_1(la_2 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        ib_1 a6;
        ib_1 ib_12 = a6;
        ib_12.c = a2;
        ib_12.M = a3;
        a6.C = a4;
        a6.b = a5;
    }
}

