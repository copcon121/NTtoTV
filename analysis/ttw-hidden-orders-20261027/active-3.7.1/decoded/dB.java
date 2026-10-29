/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package ttw.tradefinder;

import java.awt.Component;
import java.util.function.Consumer;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.Ff;
import ttw.tradefinder.Ic;
import ttw.tradefinder.Id;
import ttw.tradefinder.MC;
import ttw.tradefinder.Q;
import ttw.tradefinder.YB;
import ttw.tradefinder.bB;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.ee;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.qE;
import ttw.tradefinder.qb;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sf_0;
import ttw.tradefinder.ya_1;
import ttw.tradefinder.ye_1;
import ttw.tradefinder.zc_0;
import velox.gui.colors.ColorsConfigItem;

public class dB
extends sc_1 {
    public static final long C = 79147634832545L;
    private final zc_0 c;

    public void H(Q a2) {
        dB a3;
        a2 = new ColorsConfigItem(a2.E(), a2.E(), (Consumer)new MC(a3, a2));
        a3.a(new JLabel("Color"), (Component)((Object)a2));
    }

    private /* synthetic */ void A(Q a2) {
        dB a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(lc_0.C).toArray(new String[0]);
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
        jComboBox2.addActionListener(new qb(a3, jComboBox, a2));
        a3.a(new JLabel("Position"), jComboBox);
    }

    private /* synthetic */ void d(Q a2) {
        dB a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(Ic.b).toArray(new String[0]);
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
        jComboBox2.addActionListener(new ya_1(a3, jComboBox, a2));
        a3.j(new JLabel("Size"), jComboBox, qE.E(ye_1.b));
    }

    private /* synthetic */ void a(Q a2) {
        dB a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(df_1.b).toArray(new String[0]);
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
        jComboBox2.addActionListener(new bB(a3, jComboBox, a2));
        a3.a(new JLabel("Show price"), jComboBox);
    }

    private /* synthetic */ void j(Q a2) {
        dB a3;
        int n2;
        String string = ee.E(a2.E());
        String[] stringArray = ee.E(eC.M).toArray(new String[0]);
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
        jComboBox2.addActionListener(new Id(a3, jComboBox, a2));
        a3.a(new JLabel("Symbol"), jComboBox);
    }

    public dB(String a2, String a3, Q a4) {
        super(a2, a3 + " Settings");
        dB a5;
        dB dB2 = a5;
        Q q = a4;
        dB dB3 = a5;
        Q q2 = a4;
        a5.c = new zc_0(a4);
        a5.H(q2);
        dB3.j(q2);
        dB3.d(a4);
        a5.A(q);
        dB2.a(q);
        dB2.E(a4);
        dB2.f(dB2.c);
        a5.a();
    }

    private /* synthetic */ void E(Q a2) {
        dB a3;
        int n2 = Math.max(8, Math.min(24, a2.E()));
        JSlider jSlider = new JSlider(0, 8, 24, n2);
        jSlider.addChangeListener(new YB(a3, a2));
        a3.a(new JLabel("Text Size"), (Component)jSlider);
    }
}

