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
import ttw.tradefinder.ta_1;
import ttw.tradefinder.z;
import ttw.tradefinder.za_1;

public class tb
implements ActionListener {
    public final /* synthetic */ ta_1 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ z c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        tb a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), za_1.M);
        if (a2 != a3.c.ttw_tradefinder_za_1_E()) {
            tb tb2 = a3;
            tb2.c.E((za_1)((Object)a2));
            tb2.M.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.c))));
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tb(ta_1 a2, JComboBox a3, z a4) {
        tb a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }
}

