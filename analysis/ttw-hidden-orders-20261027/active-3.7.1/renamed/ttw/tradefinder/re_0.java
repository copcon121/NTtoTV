/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.rE
 */
public class re_0
implements ActionListener {
    public final /* synthetic */ JComboBox A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ dE M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        re_0 a3;
        a2 = ee.E(a3.A.getSelectedItem().toString(), ae_2.c);
        if (a2 != ((za_0)a3.C.M).C) {
            re_0 re_02;
            boolean bl;
            ((za_0)a3.C.M).C = a2;
            re_0 re_03 = a3;
            a3.M.ttw_tradefinder_f_0_E().E(ac_2.E("@6CO\\\u000bp\u0006q\f[\u0010p\u0007f\u0011"), re_03.c.M, a3.C);
            sc_1 sc_12 = re_03.b;
            if (((za_0)a3.C.M).C != ae_2.c) {
                bl = true;
                re_02 = a3;
            } else {
                bl = false;
                re_02 = a3;
            }
            sc_12.E(bl, re_02.M.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ re_0(dE a2, JComboBox a3, df_0 a4, ze_2 a5, sc_1 a6) {
        re_0 a7;
        re_0 re_02 = a7;
        a7.M = a2;
        re_02.A = a3;
        re_02.C = a4;
        a7.c = a5;
        a7.b = a6;
    }
}

