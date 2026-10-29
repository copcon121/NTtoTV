/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.ea_1;
import ttw.tradefinder.n;
import ttw.tradefinder.sB;

/*
 * Renamed from ttw.tradefinder.mc
 */
public class mc_1
implements ActionListener {
    public final /* synthetic */ String A;
    public final /* synthetic */ String C;
    public final /* synthetic */ n M;
    public final /* synthetic */ ea_1 b;
    public final /* synthetic */ JButton c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        mc_1 a3;
        mc_1 mc_12 = a3;
        JOptionPane.showMessageDialog(a3.c, new sB(mc_12.A, mc_12.C, a3.M), a3.C + " Line Settings", -1);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ mc_1(ea_1 a2, JButton a3, String a4, String a5, n a6) {
        mc_1 a7;
        mc_1 mc_12 = a7;
        a7.b = a2;
        mc_12.c = a3;
        mc_12.A = a4;
        a7.C = a5;
        a7.M = a6;
    }
}

