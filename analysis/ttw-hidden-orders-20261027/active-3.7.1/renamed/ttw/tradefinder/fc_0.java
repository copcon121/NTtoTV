/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.ImageIcon;
import javax.swing.JComboBox;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.hd;
import ttw.tradefinder.ta_1;
import ttw.tradefinder.z;

/*
 * Renamed from ttw.tradefinder.Fc
 */
public class fc_0
implements ActionListener {
    public final /* synthetic */ ta_1 M;
    public final /* synthetic */ z b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ fc_0(ta_1 a2, JComboBox a3, z a4) {
        fc_0 a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        fc_0 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), hd.b);
        if (a2 != a3.b.ttw_tradefinder_hd_E()) {
            fc_0 fc_02 = a3;
            fc_02.b.E((hd)((Object)a2));
            fc_02.M.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.b))));
        }
    }
}

