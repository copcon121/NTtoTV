/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ee;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.q_0;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;

/*
 * Renamed from ttw.tradefinder.re
 */
public class re_2
implements ActionListener {
    public final /* synthetic */ q_0 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ gf_2 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        re_2 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), rd_2.H);
        if (a2 != a3.c.C) {
            re_2 re_22 = a3;
            re_22.c.A = te_1.b;
            re_22.c.C = a2;
            re_22.M.E();
            re_22.M.j();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ re_2(JComboBox a2, gf_2 a3, q_0 a4) {
        re_2 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }
}

