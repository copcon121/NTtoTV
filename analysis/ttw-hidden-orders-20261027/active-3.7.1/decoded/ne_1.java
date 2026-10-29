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
        mg_0 mg_02 = new mg_0("Copy", a2);
        Vd vd = new Vd("Cut", a2);
        Ag ag = new Ag("Paste", a2);
        rf_0 rf_02 = new rf_0("Select All", a2);
        vd.putValue("AcceleratorKey", KeyStroke.getKeyStroke("control X"));
        mg_02.putValue("AcceleratorKey", KeyStroke.getKeyStroke("control C"));
        ag.putValue("AcceleratorKey", KeyStroke.getKeyStroke("control V"));
        rf_02.putValue("AcceleratorKey", KeyStroke.getKeyStroke("control A"));
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

