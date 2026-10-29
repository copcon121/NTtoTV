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
import ttw.tradefinder.kc_1;
import ttw.tradefinder.la_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;

/*
 * Renamed from ttw.tradefinder.rB
 */
public class rb_2
implements ActionListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ String C;
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ la_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ rb_2(la_2 a2, JComboBox a3, df_0 a4, sc_1 a5, String a6) {
        rb_2 a7;
        rb_2 rb_22 = a7;
        a7.c = a2;
        rb_22.M = a3;
        rb_22.A = a4;
        a7.b = a5;
        a7.C = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        rb_2 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), kc_1.A);
        if (a2 != ((dc_2)a3.A.M).C) {
            ((dc_2)a3.A.M).C = a2;
            rb_2 rb_22 = a3;
            rb_22.b.E(((dc_2)rb_22.A.M).C != kc_1.A);
            rb_2 rb_23 = a3;
            a3.c.E().E(a3.c.E().f(), rb_23.C, a3.A);
            rb_23.A.E(pf_0.C);
        }
    }
}

