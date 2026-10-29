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
import ttw.tradefinder.za_1;

public class YC
implements ActionListener {
    public final /* synthetic */ P M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ fa_1 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        YC a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), za_1.M);
        if (a2 != a3.M.ttw_tradefinder_za_1_E()) {
            YC yC = a3;
            yC.M.E((za_1)((Object)a2));
            yC.c.a(a3.M);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ YC(fa_1 a2, JComboBox a3, P a4) {
        YC a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }
}

