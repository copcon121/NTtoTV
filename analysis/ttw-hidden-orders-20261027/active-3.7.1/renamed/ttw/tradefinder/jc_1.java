/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.n;
import ttw.tradefinder.sB;
import ttw.tradefinder.zb_1;

/*
 * Renamed from ttw.tradefinder.Jc
 */
public class jc_1
implements ActionListener {
    public final /* synthetic */ String A;
    public final /* synthetic */ zb_1 C;
    public final /* synthetic */ String M;
    public final /* synthetic */ JButton b;
    public final /* synthetic */ n c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        jc_1 a3;
        jc_1 jc_12 = a3;
        JOptionPane.showMessageDialog(a3.b, new sB(jc_12.A, jc_12.M, a3.c), a3.M + " Line Settings", -1);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ jc_1(zb_1 a2, JButton a3, String a4, String a5, n a6) {
        jc_1 a7;
        jc_1 jc_12 = a7;
        a7.C = a2;
        jc_12.b = a3;
        jc_12.A = a4;
        a7.M = a5;
        a7.c = a6;
    }
}

