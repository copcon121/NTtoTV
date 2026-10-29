/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ra;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.lf
 */
public class lf_0
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ lg c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        lf_0 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((ra)a3.C.M).C) {
            ((ra)a3.C.M).C = a2;
            a3.c.E().E(qe_2.E("^[]\"Gnxdo{Owzce}o}"), a3.b.M, a3.C);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ lf_0(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        lf_0 a6;
        lf_0 lf_02 = a6;
        lf_02.c = a2;
        lf_02.M = a3;
        a6.C = a4;
        a6.b = a5;
    }
}

