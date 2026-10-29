/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.KB;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.ze_2;

public class WF
implements ActionListener {
    public final /* synthetic */ lg C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        WF a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((pa_0)a3.c.M).C) {
            ((pa_0)a3.c.M).C = a2;
            a3.C.ttw_tradefinder_f_0_E().E(KB.E("\u0006\u0010\u0005i\u001f% /70\u0017<\"(=676"), a3.b.M, a3.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ WF(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        WF a6;
        WF wF = a6;
        wF.C = a2;
        wF.M = a3;
        a6.c = a4;
        a6.b = a5;
    }
}

