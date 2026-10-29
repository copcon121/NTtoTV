/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JPopupMenu;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import ttw.tradefinder.Ag;
import ttw.tradefinder.Vd;
import ttw.tradefinder.mg_0;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.rf_0;
import ttw.tradefinder.sd_1;

/*
 * Renamed from ttw.tradefinder.Ne
 */
public class ne_1 {
    public static /* synthetic */ void E(JTextField a2) {
        JPopupMenu jPopupMenu = new JPopupMenu();
        mg_0 mg_02 = new mg_0(pb_2.E("a\u0007R\u0011"), a2);
        Vd vd = new Vd(sd_1.E("|TK"), a2);
        Ag ag = new Ag(pb_2.E("8C\u001bV\r"), a2);
        rf_0 rf_02 = new rf_0(sd_1.E("rZMZBK\u0001~MS"), a2);
        vd.putValue(pb_2.E("c\u000bA\rN\rP\tV\u0007P#G\u0011"), KeyStroke.getKeyStroke(sd_1.E("\\NQUMNS\u0001g")));
        mg_02.putValue(pb_2.E("c\u000bA\rN\rP\tV\u0007P#G\u0011"), KeyStroke.getKeyStroke(sd_1.E("\\NQUMNS\u0001|")));
        ag.putValue(pb_2.E("c\u000bA\rN\rP\tV\u0007P#G\u0011"), KeyStroke.getKeyStroke(sd_1.E("\\NQUMNS\u0001i")));
        rf_02.putValue(pb_2.E("c\u000bA\rN\rP\tV\u0007P#G\u0011"), KeyStroke.getKeyStroke(sd_1.E("\\NQUMNS\u0001~")));
        jPopupMenu.add(vd);
        jPopupMenu.add(mg_02);
        jPopupMenu.add(ag);
        JPopupMenu jPopupMenu2 = jPopupMenu;
        jPopupMenu2.addSeparator();
        jPopupMenu2.add(rf_02);
        a2.setComponentPopupMenu(jPopupMenu);
    }

    public /* synthetic */ ne_1() {
        ne_1 a2;
    }
}

