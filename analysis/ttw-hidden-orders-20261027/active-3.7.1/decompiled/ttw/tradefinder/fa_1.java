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
import ttw.tradefinder.Ad;
import ttw.tradefinder.P;
import ttw.tradefinder.YC;
import ttw.tradefinder.eb_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.hd;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.sb_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tc_0;
import ttw.tradefinder.vE;
import ttw.tradefinder.yb_1;
import ttw.tradefinder.za_1;
import velox.gui.colors.ColorsConfigItem;

/*
 * Renamed from ttw.tradefinder.FA
 */
public class fa_1
extends sc_1 {
    public static final long C = 75147634832545L;
    private final JLabel c;

    public fa_1(String a2, String a3, P a4) {
        super(a2, a3 + " Settings");
        fa_1 a5;
        fa_1 fa_12 = a5;
        P p = a4;
        fa_1 fa_13 = a5;
        P p2 = a4;
        a5.c = new JLabel();
        a5.c.setHorizontalAlignment(0);
        a5.a(p2);
        fa_13.A(p2);
        fa_13.H(a4);
        a5.E(p);
        fa_12.j(p);
        fa_12.d(a4);
        fa_12.f(fa_12.c);
    }

    private /* synthetic */ void H(P a2) {
        fa_1 a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(Ad.C).toArray(new String[0]);
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
        jComboBox2.addActionListener(new tc_0(a3, jComboBox, a2));
        a3.a(new JLabel(vE.E("\u0004\u0002:\u00198\u0017")), jComboBox);
    }

    public void A(P a2) {
        fa_1 a3;
        a2 = new ColorsConfigItem(a2.E(), a2.E(), (Consumer)new sb_0(a3, a2));
        a3.a(new JLabel(gc_1.E("!]\u000e]\u0010")), (Component)((Object)a2));
    }

    private /* synthetic */ void d(P a2) {
        fa_1 a3;
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
        jComboBox2.addActionListener(new YC(a3, jComboBox, a2));
        a3.a(new JLabel(gc_1.E("+\\\u0016W\fA\u000bF\u001b")), jComboBox);
    }

    private /* synthetic */ void a(P a2) {
        fa_1 a3;
        a2 = new ib_0(a2.E(), a2.E(), a2.E(), a2.E(), a2.E());
        a3.c.setIcon(new ImageIcon(gc_1.E((ib_0)a2, 10)));
    }

    private /* synthetic */ void j(P a2) {
        fa_1 a3;
        int n2 = Math.max(40, Math.min(260, a2.E()));
        JSlider jSlider = new JSlider(0, 40, 260, n2);
        jSlider.addChangeListener(new eb_2(a3, a2));
        a3.a(new JLabel(vE.E("\u0007\u0014$\u0012#\u00128\u0015")), (Component)jSlider);
    }

    private /* synthetic */ void E(P a2) {
        fa_1 a3;
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
        jComboBox2.addActionListener(new yb_1(a3, jComboBox, a2));
        a3.a(new JLabel(gc_1.E("a\u000bH\u0007")), jComboBox);
    }
}

