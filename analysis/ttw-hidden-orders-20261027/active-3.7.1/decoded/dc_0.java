/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JPasswordField;
import ttw.tradefinder.qc_1;

/*
 * Renamed from ttw.tradefinder.DC
 */
public class dc_0
implements ActionListener {
    public final /* synthetic */ JButton M;
    public final /* synthetic */ JPasswordField b;
    public final /* synthetic */ qc_1 c;

    @Override
    public /* synthetic */ void actionPerformed(ActionEvent a22) {
        dc_0 a3;
        boolean a22 = a3.b.getEchoChar() == '*';
        dc_0 dc_02 = a3;
        a3.M.setIcon(new ImageIcon(a22 ? dc_02.c.E : dc_02.c.M));
        a3.b.setEchoChar(a22 ? (char)'\u0000' : '*');
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ dc_0(qc_1 a2, JPasswordField a3, JButton a4) {
        dc_0 a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }
}

