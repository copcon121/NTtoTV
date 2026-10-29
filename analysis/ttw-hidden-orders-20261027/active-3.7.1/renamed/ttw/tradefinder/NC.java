/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.s;
import ttw.tradefinder.xa_1;

public class NC
implements ActionListener {
    public final /* synthetic */ ba_0 M;
    public final /* synthetic */ s b;
    public final /* synthetic */ JComboBox c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        NC a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), xa_1.A);
        if (a2 != a3.b.ttw_tradefinder_xa_1_E()) {
            NC nC = a3;
            nC.b.E((xa_1)((Object)a2));
            nC.M.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ NC(ba_0 a2, JComboBox a3, s a4) {
        NC a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }
}

