/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.P;
import ttw.tradefinder.ee;
import ttw.tradefinder.fa_1;
import ttw.tradefinder.hd;

/*
 * Renamed from ttw.tradefinder.yb
 */
public class yb_1
implements ActionListener {
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ P b;
    public final /* synthetic */ fa_1 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        yb_1 a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), hd.b);
        if (a2 != a3.b.E()) {
            yb_1 yb_12 = a3;
            yb_12.b.E((hd)((Object)a2));
            yb_12.c.a(a3.b);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ yb_1(fa_1 a2, JComboBox a3, P a4) {
        yb_1 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }
}

