/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.ze_2;

public class Xe
implements ActionListener {
    public final /* synthetic */ gd_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ JComboBox c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        Xe a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Oa)a3.b.M).E) {
            ((Oa)a3.b.M).E = a2;
            a3.C.ttw_tradefinder_f_0_E().E(ed_2.E("ArB\u000bYOdS|B|RlrgGvMpT"), a3.M.M, a3.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Xe(gd_0 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        Xe a6;
        Xe xe = a6;
        xe.C = a2;
        xe.c = a3;
        a6.b = a4;
        a6.M = a5;
    }
}

