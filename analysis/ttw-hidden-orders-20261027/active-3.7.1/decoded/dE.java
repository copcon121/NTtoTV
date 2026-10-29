/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import ttw.tradefinder.IF;
import ttw.tradefinder.K;
import ttw.tradefinder.Le;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ad_2;
import ttw.tradefinder.ae_0;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.bd_1;
import ttw.tradefinder.cE;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.d;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.ef;
import ttw.tradefinder.eg;
import ttw.tradefinder.el;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gf;
import ttw.tradefinder.if_0;
import ttw.tradefinder.jb_2;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.qE;
import ttw.tradefinder.qF;
import ttw.tradefinder.ra_0;
import ttw.tradefinder.re_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.we_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.yF;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

public class dE
extends ad_2 {
    private final K M;
    private int b = -1;
    private final K c;

    private /* synthetic */ void e(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE a5;
        if (!a5.E().j()) {
            return;
        }
        bd_1 bd_12 = new bd_1(a5, a3, a4);
        if (!a5.c.E(a3.j)) {
            yf_2.E(a2, ((za_0)a4.M).D, bd_12);
            return;
        }
        yf_2.E(a3.M, a2, ((za_0)a4.M).D, bd_12);
    }

    private /* synthetic */ void C(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((za_0)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((za_0)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new gf(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    @Override
    public void a() {
        dE a2;
        dE dE2 = a2;
        super.a();
        dE2.c.E();
        dE2.M.E();
    }

    private /* synthetic */ void g(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        int n2;
        dE a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((za_0)a4.M).c);
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
        jComboBox2.addActionListener(new eg(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Send Telegram Notification"), jComboBox));
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((za_0)a4.M).a));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new qF(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel("Order Size Trigger"), (Component)serializable, qE.E(ae_0.C, a3));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        dE a6;
        dE dE2 = a6;
        a5 = dE2.E().E("TTW-HiddenOrders", a2.M, new za_0(a2.A));
        df_0<ra_0, d> df_02 = dE2.E().E("TTW-HiddenOrders", a2.M, new ra_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.C) {
            a6.C(a3, a2, (df_0<za_0, el>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.L) {
            sc_1 sc_12 = a3;
            a6.j(sc_12, a2, (df_0<za_0, el>)a5);
            a6.a(sc_12, a2, (df_0<za_0, el>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.k) {
            sc_1 sc_13 = a3;
            ze_2 ze_22 = a2;
            a6.f(a3, a2, (df_0<za_0, el>)a5);
            a6.d(a3, ze_22, (df_0<za_0, el>)a5);
            a6.H(sc_13, ze_22, (df_0<za_0, el>)a5);
            a6.l(sc_13, a2, (df_0<za_0, el>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.m) && a6.E().j()) {
            dE dE3 = a6;
            sc_1 sc_14 = a3;
            a6.e(sc_14, a2, (df_0<za_0, el>)a5);
            dE3.g(sc_14, a2, (df_0<za_0, el>)a5);
            dE3.E(a3, a2, (df_0<za_0, el>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.F) {
            a6.A(a3, a2, df_02);
        }
        return arrayList;
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        int n2;
        dE a5;
        if (!a5.M.j()) {
            return;
        }
        String string = ee.E(((za_0)a4.M).E);
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
        jComboBox2.addActionListener(new IF(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Show OrderId"), jComboBox));
    }

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE dE2;
        boolean bl;
        double d2;
        dE a5;
        if (!a5.c.E(a3.j)) {
            return;
        }
        String[] stringArray = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1000000.0;
        double d5 = Math.max(d2, Math.min(d4, ((za_0)a4.M).h));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, (String)stringArray);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        stringArray = qE.E(d2, d4, d3, (String)stringArray);
        ((JSpinner)serializable2).addChangeListener(new yF(a5, (JSpinner)serializable, a4, a3));
        sc_1 sc_12 = a2;
        a5.b = sc_12.j(new JLabel("Synthetic Ignored Size"), (Component)serializable, qE.E(ae_0.H, stringArray));
        a2.E(a5.b);
        if (((za_0)a4.M).C != ae_2.c) {
            bl = true;
            dE2 = a5;
        } else {
            bl = false;
            dE2 = a5;
        }
        sc_12.E(bl, dE2.b);
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<ra_0, d> a4) {
        dE a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((ra_0)a4.M).c);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((ra_0)a4.M).c);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new cE(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        int n2;
        dE a5;
        if (!a5.c.E(a3.j)) {
            return;
        }
        if (a3.j == dd_1.C) {
            return;
        }
        if (a3.j == dd_1.A) {
            return;
        }
        if (a3.j == dd_1.D) {
            return;
        }
        String string = ee.E(((za_0)a4.M).C);
        String[] stringArray = ee.E(ae_2.c).toArray(new String[0]);
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
        jComboBox2.addActionListener(new re_0(a5, jComboBox, a4, a3, a2));
        a2.j(new JLabel("Evaluation Method"), jComboBox, qE.E(ae_0.A));
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        int n2;
        dE a5;
        if (!a5.c.E(a3.j)) {
            return;
        }
        if (a3.j == dd_1.C) {
            return;
        }
        if (a3.j == dd_1.A) {
            return;
        }
        if (a3.j == dd_1.D) {
            return;
        }
        String string = ee.E(((za_0)a4.M).A);
        String[] stringArray = ee.E(ae_2.c).toArray(new String[0]);
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
        jComboBox2.addActionListener(new we_0(a5, jComboBox, a4, a3));
        a2.j(new JLabel("Evaluation Method"), jComboBox, qE.E(ae_0.c));
    }

    public dE(f_0 a2) {
        super(a2, "TTW-HiddenOrders");
        dE a3;
        a3.c = new Pc("UltraParameterVisibility", Arrays.asList(cd.C, cd.c, cd.D), a2.E()).E(null);
        a3.M = new Pc("HiddenOrderDevLicense", Collections.emptyList(), a2.E()).E(null);
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((za_0)a4.M).j);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((za_0)a4.M).j);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new ef(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<za_0, el> a4) {
        dE a5;
        int n2;
        String string = ee.E(((za_0)a4.M).H);
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
        jComboBox2.addActionListener(new Le(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Bookmap Alert Message"), jComboBox));
    }

    @Override
    public kc_2 E(f_0 a2, ze_2 a3, xf_2 a4) {
        dE a5;
        return new jb_2("TTW-HiddenOrders", a2, a3, a4, a5);
    }
}

