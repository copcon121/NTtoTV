/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.ta_1;
import ttw.tradefinder.ua_1;
import ttw.tradefinder.z;

/*
 * Renamed from ttw.tradefinder.VB
 */
public class vb_0
implements ActionListener {
    public final /* synthetic */ JButton A;
    public final /* synthetic */ String C;
    public final /* synthetic */ z M;
    public final /* synthetic */ String b;
    public final /* synthetic */ ua_1 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        vb_0 a3;
        vb_0 vb_02 = a3;
        JOptionPane.showMessageDialog(a3.A, new ta_1(vb_02.C, vb_02.b, a3.M), a3.b + " Settings", -1);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vb_0(ua_1 a2, JButton a3, String a4, String a5, z a6) {
        vb_0 a7;
        vb_0 vb_02 = a7;
        a7.c = a2;
        vb_02.A = a3;
        vb_02.C = a4;
        a7.b = a5;
        a7.M = a6;
    }
}

