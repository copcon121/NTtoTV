/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.P;
import ttw.tradefinder.fa_1;
import ttw.tradefinder.yc_1;

public class nd
implements ActionListener {
    public final /* synthetic */ JButton A;
    public final /* synthetic */ String C;
    public final /* synthetic */ String M;
    public final /* synthetic */ P b;
    public final /* synthetic */ yc_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nd(yc_1 a2, JButton a3, String a4, String a5, P a6) {
        nd a7;
        nd nd2 = a7;
        a7.c = a2;
        nd2.A = a3;
        nd2.C = a4;
        a7.M = a5;
        a7.b = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        nd a3;
        nd nd2 = a3;
        JOptionPane.showMessageDialog(a3.A, new fa_1(nd2.C, nd2.M, a3.b), a3.M + " Marker Settings", -1);
    }
}

