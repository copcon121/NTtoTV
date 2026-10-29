/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import javax.swing.BorderFactory;
import javax.swing.JOptionPane;
import javax.swing.JTextField;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.te_0;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.be
 */
public class be_2
implements FocusListener {
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ JTextField M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ wf_2 c;

    @Override
    public void focusGained(FocusEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ be_2(wf_2 a2, JTextField a3, df_0 a4, sc_1 a5) {
        be_2 a6;
        be_2 be_22 = a6;
        be_22.c = a2;
        be_22.M = a3;
        a6.b = a4;
        a6.C = a5;
    }

    @Override
    public void focusLost(FocusEvent a2) {
        be_2 a3;
        a2 = a3.M.getText();
        if (((String)(a2 = ((String)a2).trim())).startsWith(te_0.E("\\")) || ((String)a2).startsWith(fg_0.E(";"))) {
            be_2 be_22 = a3;
            be_22.M.setText(((jA)be_22.b.M).M);
            JOptionPane.showMessageDialog(a3.C, te_0.E("|:T=KhV-H;Z/^;\u001b&T<\u001b8I'M!_-_"));
            return;
        }
        if (!((String)a2).matches(fg_0.E("H+&]/-mE:A#\r2"))) {
            a3.M.setBorder(BorderFactory.createLineBorder(Color.red, 2));
            return;
        }
        a3.M.setBorder(BorderFactory.createEmptyBorder());
        if (!((String)a2).equals(((jA)a3.b.M).M)) {
            ((jA)a3.b.M).M = a2;
            be_2 be_23 = a3;
            a3.c.A.E(be_23.b);
            be_23.b.E(pf_0.T);
        }
    }
}

