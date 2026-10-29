/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JOptionPane;
import ttw.tradefinder.ba_0;
import ttw.tradefinder.rc_1;
import ttw.tradefinder.s;

/*
 * Renamed from ttw.tradefinder.Lb
 */
public class lb_0
implements ActionListener {
    public final /* synthetic */ JButton A;
    public final /* synthetic */ rc_1 C;
    public final /* synthetic */ String M;
    public final /* synthetic */ String b;
    public final /* synthetic */ s c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ lb_0(rc_1 a2, JButton a3, String a4, String a5, s a6) {
        lb_0 a7;
        lb_0 lb_02 = a7;
        a7.C = a2;
        lb_02.A = a3;
        lb_02.b = a4;
        a7.M = a5;
        a7.c = a6;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        lb_0 a3;
        lb_0 lb_02 = a3;
        lb_0 lb_03 = a3;
        JOptionPane.showMessageDialog(a3.A, new ba_0(lb_02.b, lb_02.M, lb_03.c, lb_03.C.D.E()), a3.M + " Marker Settings", -1);
    }
}

