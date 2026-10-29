/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.BorderFactory;
import javax.swing.JOptionPane;
import javax.swing.JTextField;
import ttw.tradefinder.df_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.nf
 */
public class nf_2
implements KeyListener {
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ JTextField b;
    public final /* synthetic */ wf_2 c;

    @Override
    public void keyTyped(KeyEvent a2) {
    }

    @Override
    public void keyPressed(KeyEvent a2) {
        if (((KeyEvent)a2).getKeyCode() == 10) {
            nf_2 a3;
            a2 = a3.b.getText();
            if (((String)(a2 = ((String)a2).trim())).startsWith(qe_2.E("h")) || ((String)a2).startsWith(nd_2.E("\u0014"))) {
                nf_2 nf_22 = a3;
                nf_22.b.setText(((jA)nf_22.M.M).M);
                JOptionPane.showMessageDialog(a3.C, qe_2.E("Hx`\u007f\u007f*bo|ynmjy/d`~/z}eyckok"));
                return;
            }
            if (!((String)a2).matches(nd_2.E("gq\t\u0007\u0000wB\u001f\u0015\u001b\fW\u001d"))) {
                a3.b.setBorder(BorderFactory.createLineBorder(Color.red, 2));
                return;
            }
            a3.b.setBorder(BorderFactory.createEmptyBorder());
            if (!((String)a2).equals(((jA)a3.M.M).M)) {
                ((jA)a3.M.M).M = a2;
                nf_2 nf_23 = a3;
                a3.c.A.E(nf_23.M);
                nf_23.M.E(pf_0.T);
            }
        }
    }

    @Override
    public void keyReleased(KeyEvent a2) {
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nf_2(wf_2 a2, JTextField a3, df_0 a4, sc_1 a5) {
        nf_2 a6;
        nf_2 nf_22 = a6;
        nf_22.c = a2;
        nf_22.b = a3;
        a6.M = a4;
        a6.C = a5;
    }
}

