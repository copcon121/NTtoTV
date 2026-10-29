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
import ttw.tradefinder.ee;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Nd
 */
public class nd_0
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ gd_0 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        nd_0 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Oa)a3.c.M).f) {
            ((Oa)a3.c.M).f = a2;
            a3.b.E().E(nd_2.E("~m}\u0014fP[LC]CMSmXXIROK"), a3.C.M, a3.c);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nd_0(gd_0 a2, JComboBox a3, df_0 a4, ze_2 a5) {
        nd_0 a6;
        nd_0 nd_02 = a6;
        nd_02.b = a2;
        nd_02.M = a3;
        a6.c = a4;
        a6.C = a5;
    }
}

