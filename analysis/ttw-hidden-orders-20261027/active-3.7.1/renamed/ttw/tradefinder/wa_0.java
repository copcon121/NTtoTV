/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.la_1;
import ttw.tradefinder.s;

/*
 * Renamed from ttw.tradefinder.WA
 */
public class wa_0
implements ActionListener {
    public final /* synthetic */ ba_0 M;
    public final /* synthetic */ s b;
    public final /* synthetic */ JComboBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ wa_0(ba_0 a2, JComboBox a3, s a4) {
        wa_0 a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        wa_0 a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), la_1.c);
        if (a2 != a3.b.ttw_tradefinder_la_1_E()) {
            wa_0 wa_02 = a3;
            wa_02.b.E((la_1)((Object)a2));
            wa_02.M.c.repaint();
        }
    }
}

