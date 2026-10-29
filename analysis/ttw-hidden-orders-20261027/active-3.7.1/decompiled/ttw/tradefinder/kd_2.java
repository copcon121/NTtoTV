/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JPasswordField;
import ttw.tradefinder.df_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.te_0;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.KD
 */
public class kd_2
implements FocusListener {
    public final /* synthetic */ wf_2 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ JButton b;
    public final /* synthetic */ JPasswordField c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ kd_2(wf_2 a2, JPasswordField a3, JButton a4, df_0 a5) {
        kd_2 a6;
        kd_2 kd_22 = a6;
        kd_22.C = a2;
        kd_22.c = a3;
        a6.b = a4;
        a6.M = a5;
    }

    @Override
    public void focusGained(FocusEvent a22) {
        kd_2 a3;
        boolean a22 = a3.c.getEchoChar() == '*';
        if (!a22) {
            return;
        }
        kd_2 kd_22 = a3;
        kd_22.b.setIcon(new ImageIcon(a3.C.M));
        kd_22.c.setEchoChar('\u0000');
    }

    @Override
    public void focusLost(FocusEvent a2) {
        kd_2 a3;
        a2 = String.valueOf(a3.c.getPassword());
        if (!((String)(a2 = ((String)a2).trim())).matches(te_0.E("\u0016`x\u0016qf3\u000ed\n}Fr`)\u00162zeax\u0016qdef3\bx\u0017|\u000b5\u001f"))) {
            a3.c.setBorder(BorderFactory.createLineBorder(Color.red, 2));
            return;
        }
        a3.c.setBorder(BorderFactory.createEmptyBorder());
        kd_2 kd_22 = a3;
        if (!((String)a2).equals(kd_22.C.E(((jA)kd_22.M.M).C))) {
            ((jA)a3.M.M).C = a3.C.j((String)a2);
            kd_2 kd_23 = a3;
            a3.C.A.E(kd_23.M);
            kd_23.M.E(pf_0.T);
        }
    }
}

