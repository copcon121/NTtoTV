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
import ttw.tradefinder.Df;
import ttw.tradefinder.Dg;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.Zc;
import ttw.tradefinder.ad_1;
import ttw.tradefinder.ad_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.de_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.e;
import ttw.tradefinder.eM;
import ttw.tradefinder.ee;
import ttw.tradefinder.ef_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.he;
import ttw.tradefinder.he_0;
import ttw.tradefinder.id_1;
import ttw.tradefinder.jd_1;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.me_0;
import ttw.tradefinder.nd_1;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.pd_1;
import ttw.tradefinder.qE;
import ttw.tradefinder.qd_1;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.td_2;
import ttw.tradefinder.vf_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ya_0;
import ttw.tradefinder.yb_2;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.ze_2;
import ttw.tradefinder.zf_0;

public class fg
extends ad_2 {
    private final K b;
    private final K c;

    private /* synthetic */ void C(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        if (!a5.ttw_tradefinder_f_0_E().boolean_j()) {
            return;
        }
        nd_1 nd_12 = new nd_1(a5, a3, a4);
        if (!a5.c.E(a3.j)) {
            yf_2.E(a2, ((Zc)a4.M).B, nd_12);
            return;
        }
        yf_2.E(a3.M, a2, ((Zc)a4.M).B, nd_12);
    }

    private /* synthetic */ void a(sc_1 a2, String a3, df_0<Zc, eM> a4) {
        fg a5;
        if (!a5.b.boolean_j()) {
            return;
        }
        int n2 = Math.max(0, Math.min(20000, ((Zc)a4.M).a));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 20000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new ad_1(a5, jSpinner, a4, (String)a3));
        int n3 = Math.max(0, Math.min(20000, ((Zc)a4.M).C));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 20000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new id_1(a5, (JSpinner)serializable, a4, (String)a3));
        a3 = qE.E(0, 20000, 1);
        a2.j(new JLabel(pb_2.E("f'oHn\rT\rNHD\u001aM\u0005")), (Component)jSpinner, qE.E(Df.M, a3));
        a2.j(new JLabel(pb_2.E("f'oHn\rT\rNHV\u0007")), (Component)serializable, qE.E(Df.c, a3));
    }

    private /* synthetic */ void g(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2;
        String string = ee.E(((Zc)a4.M).A);
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
        jComboBox2.addActionListener(new me_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(pb_2.E("*M\u0007I\u0005C\u0018\u0002)N\rP\u001c\u0002%G\u001bQ\tE\r")), jComboBox));
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<ya_0, e> a4) {
        fg a5;
        if (!a5.b.boolean_j()) {
            return;
        }
        JCheckBox jCheckBox = new JCheckBox(pb_2.E("g\u0006C\nN\r"));
        jCheckBox.setSelected(((ya_0)a4.M).c);
        sc_1 sc_12 = a2;
        sc_12.void_E(jCheckBox);
        sc_12.E(((ya_0)a4.M).c);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new vf_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void j(sc_1 a2, String a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2 = Math.max(0, Math.min(20000, ((Zc)a4.M).c));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 20000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new he(a5, jSpinner, a4, (String)a3));
        int n3 = Math.max(0, Math.min(20000, ((Zc)a4.M).E));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 20000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new de_0(a5, (JSpinner)serializable, a4, (String)a3));
        a3 = qE.E(0, 20000, 1);
        a2.j(new JLabel(pb_2.E("f'oHn\rT\rNHD\u001aM\u0005")), (Component)jSpinner, qE.E(Df.M, a3));
        a2.j(new JLabel(pb_2.E("f'oHn\rT\rNHV\u0007")), (Component)serializable, qE.E(Df.c, a3));
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2;
        String string = ee.E(((Zc)a4.M).j);
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
        jComboBox2.addActionListener(new ef_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(pb_2.E("q\rL\f\u0002<G\u0004G\u000fP\tOHl\u0007V\u0001D\u0001A\tV\u0001M\u0006")), jComboBox));
    }

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2;
        String string = ee.E(((Zc)a4.M).K);
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
        jComboBox2.addActionListener(new qd_1(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(pb_2.E("*M\u0007I\u0005C\u0018\u0002)N\rP\u001c\u0002%G\u001bQ\tE\r")), jComboBox));
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        if (!a5.ttw_tradefinder_f_0_E().boolean_j()) {
            return;
        }
        he_0 he_02 = new he_0(a5, a3, a4);
        if (!a5.c.E(a3.j)) {
            yf_2.E(a2, ((Zc)a4.M).D, he_02);
            return;
        }
        yf_2.E(a3.M, a2, ((Zc)a4.M).D, he_02);
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        JCheckBox jCheckBox = new JCheckBox(pb_2.E("g\u0006C\nN\r"));
        jCheckBox.setSelected(((Zc)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.void_E(jCheckBox);
        sc_12.E(((Zc)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new pd_1(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void E(sc_1 a2, String a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2 = Math.max(10, Math.min(2000, ((Zc)a4.M).b));
        Serializable serializable = new SpinnerNumberModel(n2, 10, 2000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new td_2(a5, (JSpinner)serializable, a4, (String)a3));
        a3 = qE.E(10, 2000, 1);
        a2.j(new JLabel(pb_2.E("<P\u0001E\u000fG\u001a\u00023\u00075")), (Component)serializable, qE.E(Df.b, a3));
    }

    public fg(f_0 a2) {
        super(a2, pb_2.E("v<uEk\u0005@\tN\tL\u000bG<P\tA\u0003G\u001a"));
        fg a3;
        Pc pc = new Pc(pb_2.E("g\u0010V\rL\fG\fq\u0007W\u0006F+M\u0006D\u0001E\u001dP\tV\u0001M\u0006"), Arrays.asList(cd.C, cd.c, cd.D), a2.ttw_tradefinder_qc_1_E());
        fg fg2 = a3;
        fg2.c = pc.E(null);
        fg2.b = new Pc(pb_2.E(" K\fF\rL'P\fG\u001af\rT$K\u000bG\u0006Q\r"), Collections.emptyList(), a2.ttw_tradefinder_qc_1_E()).E(null);
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        int n2;
        String string = ee.E(((Zc)a4.M).h);
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
        jComboBox2.addActionListener(new Dg(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(pb_2.E("q\rL\f\u0002<G\u0004G\u000fP\tOHl\u0007V\u0001D\u0001A\tV\u0001M\u0006")), jComboBox));
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<ya_0, e> a4) {
        fg a5;
        JCheckBox jCheckBox = new JCheckBox(pb_2.E("g\u0006C\nN\r"));
        jCheckBox.setSelected(((ya_0)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.void_E(jCheckBox);
        sc_12.E(((ya_0)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new jd_1(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    @Override
    public void a() {
        fg a2;
        fg fg2 = a2;
        super.a();
        fg2.c.void_E();
        fg2.b.void_E();
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<Zc, eM> a4) {
        fg a5;
        JCheckBox jCheckBox = new JCheckBox(pb_2.E("g\u0006C\nN\r"));
        jCheckBox.setSelected(((Zc)a4.M).H);
        sc_1 sc_12 = a2;
        sc_12.void_E(jCheckBox);
        sc_12.E(((Zc)a4.M).H);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new zf_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        fg a6;
        fg fg2 = a6;
        a5 = fg2.ttw_tradefinder_f_0_E().E(pb_2.E("v<uEk\u0005@\tN\tL\u000bG<P\tA\u0003G\u001a"), a2.M, new Zc());
        df_0<ya_0, e> df_02 = fg2.ttw_tradefinder_f_0_E().E(pb_2.E("v<uEk\u0005@\tN\tL\u000bG<P\tA\u0003G\u001a"), a2.M, new ya_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.java_lang_String_E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.K) {
            a6.j(a3, a2.M, (df_0<Zc, eM>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.d) {
            a6.a(a3, a2.M, (df_0<Zc, eM>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.T) {
            a6.d(a3, a2, (df_0<Zc, eM>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.H) {
            fg fg3 = a6;
            fg3.E(a3, a2.M, (df_0<Zc, eM>)a5);
            if (fg3.ttw_tradefinder_f_0_E().boolean_j()) {
                fg fg4 = a6;
                sc_1 sc_12 = a3;
                a6.C(sc_12, a2, (df_0<Zc, eM>)a5);
                fg4.a(sc_12, a2, (df_0<Zc, eM>)a5);
                fg4.g(a3, a2, (df_0<Zc, eM>)a5);
            }
        }
        if (a4 == nf_0.O || a4 == nf_0.B) {
            a6.E(a3, a2, (df_0<Zc, eM>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.J) && a6.ttw_tradefinder_f_0_E().boolean_j()) {
            fg fg5 = a6;
            sc_1 sc_13 = a3;
            a6.A(sc_13, a2, (df_0<Zc, eM>)a5);
            fg5.l(sc_13, a2, (df_0<Zc, eM>)a5);
            fg5.H(a3, a2, (df_0<Zc, eM>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.o) {
            a6.j(a3, a2, df_02);
        }
        if (a4 == nf_0.O || a4 == nf_0.c) {
            a6.f(a3, a2, df_02);
        }
        return arrayList;
    }

    @Override
    public kc_2 E(f_0 a2, ze_2 a3, xf_2 a4) {
        fg a5;
        return new yb_2(pb_2.E("v<uEk\u0005@\tN\tL\u000bG<P\tA\u0003G\u001a"), a2, a3, a4, a5);
    }
}

