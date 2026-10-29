/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ee;
import ttw.tradefinder.of_0;
import ttw.tradefinder.rd_2;

/*
 * Renamed from ttw.tradefinder.YF
 */
public class yf_1
implements ActionListener {
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ of_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ yf_1(of_0 a2, JComboBox a3) {
        yf_1 a4;
        a4.c = a2;
        a4.b = a3;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        yf_1 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), rd_2.H);
        if (a2 != a3.c.a.ttw_tradefinder_rd_2_E()) {
            a3.c.a.E((rd_2)((Object)a2));
        }
    }
}

