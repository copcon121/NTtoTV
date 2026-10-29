/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import ttw.tradefinder.ad_0;
import ttw.tradefinder.cb_1;
import ttw.tradefinder.le_1;
import ttw.tradefinder.mc_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.yc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.wC
 */
public class wc_1
extends sc_1 {
    public static final long C = 74148236912335L;
    private final yc_2 b;
    private final JCheckBox c;

    public wc_1(ze_2 a2, yc_2 a3) {
        wc_1 a4;
        ze_2 ze_22 = a2;
        super(ze_22.M, ze_22.M);
        a4.c = new JCheckBox(le_1.E("\u00105499>"));
        a4.b = a3;
        a4.void_A();
    }

    private /* synthetic */ void void_A() {
        wc_1 a2;
        wc_1 wc_12 = a2;
        wc_1 wc_13 = a2;
        wc_13.void_E(wc_13.c);
        wc_12.E(false);
        wc_13.c.addItemListener(new mc_2(a2));
        JButton jButton = new JButton(le_1.E("g"));
        jButton.addActionListener(new cb_1(a2));
        JButton jButton2 = new JButton(le_1.E("e"));
        jButton2.addActionListener(new ad_0(a2));
        wc_12.j((Component)wc_12.c, (Component)jButton, jButton2);
    }

    public void void_d() {
        wc_1 a2;
        a2.c.setSelected(false);
    }
}

