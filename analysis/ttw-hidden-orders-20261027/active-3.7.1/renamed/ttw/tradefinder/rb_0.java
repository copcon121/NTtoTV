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
import ttw.tradefinder.yb_0;
import ttw.tradefinder.z;

/*
 * Renamed from ttw.tradefinder.Rb
 */
public class rb_0
implements ActionListener {
    public final /* synthetic */ z M;
    public final /* synthetic */ ta_1 b;
    public final /* synthetic */ JComboBox c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        rb_0 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), yb_0.c);
        if (a2 != a3.M.ttw_tradefinder_yb_0_E()) {
            rb_0 rb_02 = a3;
            rb_02.M.E((yb_0)((Object)a2));
            rb_02.b.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a3.M))));
            rb_02.b.A(a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ rb_0(ta_1 a2, JComboBox a3, z a4) {
        rb_0 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }
}

