/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.KA;
import ttw.tradefinder.NC;
import ttw.tradefinder.Tc;
import ttw.tradefinder.cC;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.db_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.gc;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.hd_0;
import ttw.tradefinder.ia_1;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.la_1;
import ttw.tradefinder.md;
import ttw.tradefinder.nc_0;
import ttw.tradefinder.s;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wB;
import ttw.tradefinder.wa_0;
import ttw.tradefinder.xa_1;

/*
 * Renamed from ttw.tradefinder.bA
 */
public class ba_0
extends sc_1 {
    public static final long C = 77147634832545L;
    private final ia_1 c;

    private /* synthetic */ void l(s a2) {
        ba_0 a3;
        s s2 = a2;
        int n2 = s2.j() - 20;
        n2 = s2.E() == wB.M ? n2 : -n2;
        n2 = Math.max(-230, Math.min(230, n2));
        JSlider jSlider = new JSlider(0, -230, 230, n2);
        jSlider.addChangeListener(new md(a3, 20, a2));
        a3.a(new JLabel(hd_0.E("axB~E~^y")), (Component)jSlider);
    }

    private /* synthetic */ void H(s a2) {
        ba_0 a3;
        int n2 = Math.max(8, Math.min(20, a2.E()));
        JSlider jSlider = new JSlider(0, 8, 20, n2);
        jSlider.addChangeListener(new KA(a3, a2));
        a3.a(new JLabel(hd_0.E("b~Kr")), (Component)jSlider);
    }

    private /* synthetic */ void A(s a2) {
        ba_0 a3;
        int n2 = a2.E() == db_0.b ? 0 : 1;
        n2 = n2 + (a2.E() == ic_0.b ? 0 : 2);
        n2 = Math.max(0, Math.min(3, n2));
        JSlider jSlider = new JSlider(0, 0, 3, n2);
        jSlider.addChangeListener(new Tc(a3, a2));
        a3.a(new JLabel(hd_0.E("}vHxDc")), (Component)jSlider);
    }

    private /* synthetic */ void d(s a2) {
        ba_0 a3;
        int n2 = Math.max(10, Math.min(255, a2.a()));
        JSlider jSlider = new JSlider(0, 10, 255, n2);
        jSlider.addChangeListener(new gc(a3, a2));
        a3.a(new JLabel(gc_1.E("f\u0010S\fA\u0012S\u0010W\fQ\u001b")), (Component)jSlider);
    }

    private /* synthetic */ void a(s a2) {
        ba_0 a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(la_1.c).toArray(new String[0]);
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
        jComboBox2.addActionListener(new wa_0(a3, jComboBox, a2));
        a3.a(new JLabel(gc_1.E("!]\u000e]\u0010")), jComboBox);
    }

    public ba_0(String a2, String a3, s a4, cc_0 a5) {
        super(a2, a3 + " Settings");
        ba_0 a6;
        ba_0 ba_02 = a6;
        s s2 = a4;
        ba_0 ba_03 = a6;
        s s3 = a4;
        a6.c = new ia_1(a4, a5);
        a6.E(a4);
        a6.j(s3);
        ba_03.a(s3);
        ba_03.d(a4);
        a6.A(s2);
        ba_02.l(s2);
        ba_02.H(a4);
        ba_02.f(ba_02.c);
        a6.a();
    }

    private /* synthetic */ void j(s a2) {
        ba_0 a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = new String[]{ee.E(xa_1.b), ee.E(xa_1.C), ee.E(xa_1.A)};
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = n2 = 0;
        while (n3 < 3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n3 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new NC(a3, jComboBox, a2));
        a3.a(new JLabel(gc_1.E("a\u001b_\u0000]\u000e")), jComboBox);
    }

    private /* synthetic */ void E(s a2) {
        ba_0 a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(cC.C).toArray(new String[0]);
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
        jComboBox2.addActionListener(new nc_0(a3, jComboBox, a2));
        a3.a(new JLabel(gc_1.E("v\u0007A\u000bU\f")), jComboBox);
    }
}

