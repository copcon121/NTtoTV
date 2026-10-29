/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Ad;
import ttw.tradefinder.P;
import ttw.tradefinder.ee;
import ttw.tradefinder.fa_1;

/*
 * Renamed from ttw.tradefinder.tc
 */
public class tc_0
implements ActionListener {
    public final /* synthetic */ fa_1 M;
    public final /* synthetic */ P b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tc_0(fa_1 a2, JComboBox a3, P a4) {
        tc_0 a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        tc_0 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), Ad.C);
        if (a2 != a3.b.ttw_tradefinder_Ad_E()) {
            tc_0 tc_02 = a3;
            tc_02.b.E((Ad)((Object)a2));
            tc_02.M.a(a3.b);
        }
    }
}

