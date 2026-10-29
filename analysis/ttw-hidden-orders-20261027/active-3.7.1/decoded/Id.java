/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;
import ttw.tradefinder.eC;
import ttw.tradefinder.ee;

public class Id
implements ActionListener {
    public final /* synthetic */ dB M;
    public final /* synthetic */ Q b;
    public final /* synthetic */ JComboBox c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        Id a3;
        a2 = ee.E(a3.c.getSelectedItem().toString(), eC.M);
        if (a2 != a3.b.E()) {
            Id id = a3;
            id.b.E((eC)((Object)a2));
            id.M.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Id(dB a2, JComboBox a3, Q a4) {
        Id a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }
}

