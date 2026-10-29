/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.Q;
import ttw.tradefinder.dB;
import ttw.tradefinder.tb_2;

public class Zb
implements ActionListener {
    public final /* synthetic */ Q A;
    public final /* synthetic */ JButton C;
    public final /* synthetic */ String M;
    public final /* synthetic */ tb_2 b;
    public final /* synthetic */ String c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        Zb a3;
        Zb zb = a3;
        JOptionPane.showMessageDialog(a3.C, new dB(zb.M, zb.c, a3.A), a3.c + " Marker Settings", -1);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Zb(tb_2 a2, JButton a3, String a4, String a5, Q a6) {
        Zb a7;
        Zb zb = a7;
        a7.b = a2;
        zb.C = a3;
        zb.M = a4;
        a7.c = a5;
        a7.A = a6;
    }
}

