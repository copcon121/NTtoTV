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
import ttw.tradefinder.ja_0;
import ttw.tradefinder.la_2;
import ttw.tradefinder.pf_0;

public class gd
implements ActionListener {
    public final /* synthetic */ JComboBox C;
    public final /* synthetic */ la_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ String c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        gd a3;
        a2 = ee.E(a3.C.getSelectedItem().toString(), ja_0.b);
        if (a2 != ((dc_2)a3.b.M).M) {
            ((dc_2)a3.b.M).M = a2;
            gd gd2 = a3;
            a3.M.E().E(a3.M.E().f(), gd2.c, a3.b);
            gd2.b.E(pf_0.Z);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ gd(la_2 a2, JComboBox a3, df_0 a4, String a5) {
        gd a6;
        gd gd2 = a6;
        gd2.M = a2;
        gd2.C = a3;
        a6.b = a4;
        a6.c = a5;
    }
}

