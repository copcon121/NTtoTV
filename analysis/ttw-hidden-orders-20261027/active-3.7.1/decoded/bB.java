/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;

public class bB
implements ActionListener {
    public final /* synthetic */ JComboBox M;
    public final /* synthetic */ Q b;
    public final /* synthetic */ dB c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        bB a3;
        a2 = ee.E(a3.M.getSelectedItem().toString(), df_1.b);
        if (a2 != a3.b.E()) {
            bB bB2 = a3;
            bB2.b.E((df_1)((Object)a2));
            bB2.c.c.repaint();
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ bB(dB a2, JComboBox a3, Q a4) {
        bB a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }
}

