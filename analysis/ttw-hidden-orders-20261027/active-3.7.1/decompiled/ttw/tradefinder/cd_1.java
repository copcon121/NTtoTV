/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Wa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.cD
 */
public class cd_1
implements ActionListener {
    public final /* synthetic */ lg A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ String c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        cd_1 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((Wa)a3.C.M).b) {
            ((Wa)a3.C.M).b = a2;
            cd_1 cd_12 = a3;
            a3.A.E().E(nd_2.E("~m}\u0014gXXROMoAZUEKOK"), a3.M.M, cd_12.c, cd_12.C);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cd_1(lg a2, JComboBox a3, df_0 a4, ze_2 a5, String a6) {
        cd_1 a7;
        cd_1 cd_12 = a7;
        a7.A = a2;
        cd_12.b = a3;
        cd_12.C = a4;
        a7.M = a5;
        a7.c = a6;
    }
}

