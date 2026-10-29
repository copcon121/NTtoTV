/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class IF
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ dE c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ IF(dE a2, JComboBox a3, df_0 a4, ze_2 a5) {
        IF a6;
        IF iF = a6;
        iF.c = a2;
        iF.C = a3;
        a6.M = a4;
        a6.b = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        IF a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), df_1.b);
        if (a2 != ((za_0)a3.M.M).E) {
            ((za_0)a3.M.M).E = a2;
            a3.c.E().E(xf_0.E("qHr1muAx@rjnAyWo"), a3.b.M, a3.M);
        }
    }
}

