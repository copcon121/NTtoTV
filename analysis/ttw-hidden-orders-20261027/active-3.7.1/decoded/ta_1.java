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
 * Duplicate member names - consider using --renamedupmembers true
 */
public class ta_1
extends sc_1 {
    private int A;
    public static final long C = 75147634882545L;
    private int C;
    private final JLabel M;
    private int b;
    private int c;

    private /* synthetic */ void l(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.E());
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
        a3.a(new JLabel("Symbol"), jComboBox);
    }

    public int d(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.a(), a2.a(), (Consumer)new Gb(a3, a2));
        return a3.a(new JLabel("Base Color"), (Component)((Object)a2));
    }

    private /* synthetic */ int a(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.j()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new da_2(a3, a2));
        return a3.a(new JLabel("Position"), (Component)jSlider);
    }

    public void H(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.j(), a2.j(), (Consumer)new bc_1(a3, a2));
        a3.a(new JLabel("Ask Color"), (Component)((Object)a2));
    }

    private /* synthetic */ int j(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.E()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new hB(a3, a2));
        return a3.a(new JLabel("Bid Position"), (Component)jSlider);
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
        yb_0 yb_02 = a2.E();
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
        a3.j(bl2, ta_13.C);
        if (a2.E() == qc_0.M) {
            bl = true;
            ta_12 = a3;
        } else {
            bl = false;
            ta_12 = a3;
        }
        a3.j(bl, ta_12.c);
    }

    private /* synthetic */ void d(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.E());
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
        a3.a(new JLabel("Style"), jComboBox);
    }

    private /* synthetic */ void a(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.E());
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
        a3.a(new JLabel("Intensity"), jComboBox);
    }

    private /* synthetic */ int E(z a2) {
        ta_1 a3;
        int n2 = Math.max(1, Math.min(100, a2.a()));
        JSlider jSlider = new JSlider(0, 1, 100, n2);
        jSlider.addChangeListener(new xc_0(a3, a2));
        return a3.a(new JLabel("Ask Position"), (Component)jSlider);
    }

    private /* synthetic */ void j(z a2) {
        ta_1 a3;
        int n2;
        String string = ee.E(a2.E());
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
        a3.a(new JLabel("Size"), jComboBox);
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
        ta_15.C = -1;
        ta_15.A = -1;
        ta_14.b = -1;
        ta_14.c = -1;
        ta_13.M.setHorizontalAlignment(0);
        ta_13.M.setIcon(new ImageIcon(cb_0.E(new ca_1(a4))));
        ta_13.H(a4);
        ta_12.E(z2);
        ta_12.c = ta_12.d(a4);
        if (!z2.j()) {
            a5.l(a4);
        }
        a5.j(a4);
        if (!a4.E()) {
            a5.a(a4);
        }
        ta_1 ta_16 = a5;
        ta_16.d(a4);
        ta_16.C = ta_16.a(a4);
        ta_16.A = ta_16.E(a4);
        ta_16.b = ta_16.j(a4);
        ta_16.f(ta_16.M);
        a5.A(a4);
    }

    public void E(z a2) {
        ta_1 a3;
        a2 = new ColorsConfigItem(a2.E(), a2.E(), (Consumer)new lc_1(a3, a2));
        a3.a(new JLabel("Bid Color"), (Component)((Object)a2));
    }
}

