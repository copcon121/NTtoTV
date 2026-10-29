/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import javax.swing.JColorChooser;
import javax.swing.JTextField;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sa_1;

/*
 * Renamed from ttw.tradefinder.ec
 */
public class ec_1
implements MouseListener {
    public final /* synthetic */ JTextField M;
    public final /* synthetic */ sa_1 b;
    public final /* synthetic */ na_0 c;

    @Override
    public void mouseReleased(MouseEvent a2) {
    }

    @Override
    public void mouseEntered(MouseEvent a2) {
    }

    @Override
    public void mouseExited(MouseEvent a2) {
    }

    @Override
    public void mouseClicked(MouseEvent a2) {
        if (((MouseEvent)a2).getClickCount() == 3 && ((MouseEvent)a2).getButton() == 1) {
            ec_1 a3;
            ec_1 ec_12 = a3;
            a2 = JColorChooser.showDialog(ec_12.M, "Select color for \"" + ec_12.c.b + "\"", a3.c.M);
            if (a2 != null && !((Color)a2).equals(a3.c.M)) {
                ec_1 ec_13 = a3;
                ec_13.c.M = a2;
                ec_1 ec_14 = a3;
                ec_13.M.setBackground(ec_14.c.M);
                ec_14.b.c.E(a3.b.b, a3.b.var_ttw_tradefinder_ze_2_C.M, a3.b.M);
                ec_13.b.M.E(pf_0.r);
                ec_13.b.c.void_E();
            }
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ec_1(sa_1 a2, JTextField a3, na_0 a4) {
        ec_1 a5;
        a5.b = a2;
        a5.M = a3;
        a5.c = a4;
    }

    @Override
    public void mousePressed(MouseEvent a2) {
    }
}

