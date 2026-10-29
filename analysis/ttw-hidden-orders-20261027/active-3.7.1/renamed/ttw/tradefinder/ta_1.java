/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package ttw.tradefinder;

import java.awt.Component;
import java.util.function.Consumer;
import javax.swing.ImageIcon;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.Gb;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.bc_1;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.da_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.fc_0;
import ttw.tradefinder.hB;
import ttw.tradefinder.hd;
import ttw.tradefinder.if_0;
import ttw.tradefinder.lc_1;
import ttw.tradefinder.qb_0;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.rb_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tb;
import ttw.tradefinder.xc_0;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.z;
import ttw.tradefinder.za_1;
import velox.gui.colors.ColorsConfigItem;

/*
 * Renamed from ttw.tradefinder.tA
 */
public class ta_1
extends sc_1 {
    private int A;
    public static final long var_long_C = 75147634882545L;
    private int var_int_C;
    private final JLabel M;
    private int b;
    private int c;

    private /* synthetic */ void l(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.ttw_tradefinder_qc_0_E());
        String[] stringArray = ee.E(qc_0.A).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new qb_0(a3, jComboBox, a2));
        a3.a(new JLabel(ae_1.E("WXiCkM")), jComboBox);
    }

    public int int_d(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.java_awt_Color_a(), a2.java_awt_Color_a(), (Consumer)new Gb(a3, a2));
        return a3.a(new JLabel(if_0.E("\u0017z&~uX:w:i")), (Component)((Object)a2));
    }

    private /* synthetic */ int int_a(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.int_j()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new da_2(a3, a2));
        return a3.a(new JLabel(ae_1.E("TNwHpHkO")), (Component)jSlider);
    }

    public void H(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.java_awt_Color_j(), a2.java_awt_Color_j(), (Consumer)new bc_1(a3, a2));
        a3.a(new JLabel(if_0.E("Z&puX:w:i")), (Component)((Object)a2));
    }

    private /* synthetic */ int int_j(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.int_E()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new hB(a3, a2));
        return a3.a(new JLabel(ae_1.E("FH`\u0001TNwHpHkO")), (Component)jSlider);
    }

    private /* synthetic */ void A(z a2) {
        ta_1 ta_12;
        boolean bl;
        ta_1 ta_13;
        boolean bl2;
        ta_1 ta_14;
        boolean bl3;
        ta_1 ta_15;
        ta_1 a3;
        boolean bl4;
        yb_0 yb_02 = a2.ttw_tradefinder_yb_0_E();
        if (yb_02 == yb_0.M) {
            bl4 = true;
            ta_15 = a3;
        } else {
            bl4 = false;
            ta_15 = a3;
        }
        a3.j(bl4, ta_15.A);
        if (yb_02 == yb_0.M) {
            bl3 = true;
            ta_14 = a3;
        } else {
            bl3 = false;
            ta_14 = a3;
        }
        a3.j(bl3, ta_14.b);
        if (yb_02 == yb_0.c) {
            bl2 = true;
            ta_13 = a3;
        } else {
            bl2 = false;
            ta_13 = a3;
        }
        a3.j(bl2, ta_13.var_int_C);
        if (a2.ttw_tradefinder_qc_0_E() == qc_0.M) {
            bl = true;
            ta_12 = a3;
        } else {
            bl = false;
            ta_12 = a3;
        }
        a3.j(bl, ta_12.c);
    }

    private /* synthetic */ void void_d(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.ttw_tradefinder_yb_0_E());
        String[] stringArray = ee.E(yb_0.c).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new rb_0(a3, jComboBox, a2));
        a3.a(new JLabel(if_0.E("H!b9~")), jComboBox);
    }

    private /* synthetic */ void void_a(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.ttw_tradefinder_za_1_E());
        String[] stringArray = ee.E(za_1.M).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new tb(a3, jComboBox, a2));
        a3.a(new JLabel(ae_1.E("hjUaOwHpX")), jComboBox);
    }

    private /* synthetic */ int int_E(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.int_a()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new xc_0(a3, a2));
        return a3.a(new JLabel(if_0.E("\u0014h>;\u0005t&r!r:u")), (Component)jSlider);
    }

    private /* synthetic */ void void_j(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.ttw_tradefinder_hd_E());
        String[] stringArray = ee.E(hd.b).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new fc_0(a3, jComboBox, a2));
        a3.a(new JLabel(if_0.E("\u0006r/~")), jComboBox);
    }

    public ta_1(String a2, String a3, z a4) {
        super(a2, a3 + " Settings");
        ta_1 a5;
        ta_1 ta_12 = a5;
        z z2 = a4;
        ta_1 ta_13 = a5;
        ta_1 ta_14 = a5;
        ta_1 ta_15 = a5;
        a5.M = new JLabel();
        ta_15.var_int_C = -1;
        ta_15.A = -1;
        ta_14.b = -1;
        ta_14.c = -1;
        ta_13.M.setHorizontalAlignment(0);
        ta_13.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a4))));
        ta_13.H(a4);
        ta_12.void_E(z2);
        ta_12.c = ta_12.int_d(a4);
        if (!z2.boolean_j()) {
            a5.l(a4);
        }
        a5.void_j(a4);
        if (!a4.boolean_E()) {
            a5.void_a(a4);
        }
        ta_1 ta_16 = a5;
        ta_16.void_d(a4);
        ta_16.var_int_C = ta_16.int_a(a4);
        ta_16.A = ta_16.int_E(a4);
        ta_16.b = ta_16.int_j(a4);
        ta_16.f(ta_16.M);
        a5.A(a4);
    }

    public void void_E(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.java_awt_Color_E(), a2.java_awt_Color_E(), (Consumer)new lc_1(a3, a2));
        a3.a(new JLabel(ae_1.E("cmE$bkMkS")), (Component)((Object)a2));
    }
}

