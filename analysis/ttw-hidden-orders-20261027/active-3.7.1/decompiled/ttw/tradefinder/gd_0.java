/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.io.Serializable;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import ttw.tradefinder.Bg;
import ttw.tradefinder.K;
import ttw.tradefinder.KF;
import ttw.tradefinder.MF;
import ttw.tradefinder.Mg;
import ttw.tradefinder.Oa;
import ttw.tradefinder.Pc;
import ttw.tradefinder.WE;
import ttw.tradefinder.Xe;
import ttw.tradefinder.Xf;
import ttw.tradefinder.Ye;
import ttw.tradefinder.aa_2;
import ttw.tradefinder.ad_2;
import ttw.tradefinder.af;
import ttw.tradefinder.ca_2;
import ttw.tradefinder.cc_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.et;
import ttw.tradefinder.f;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fc_2;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.gb_2;
import ttw.tradefinder.ka_0;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.la_2;
import ttw.tradefinder.lb_1;
import ttw.tradefinder.ld_2;
import ttw.tradefinder.nd_0;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.oc_2;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.pc_1;
import ttw.tradefinder.pc_2;
import ttw.tradefinder.qE;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.ra_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sf;
import ttw.tradefinder.tc_2;
import ttw.tradefinder.td_0;
import ttw.tradefinder.va_0;
import ttw.tradefinder.vc_2;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.ze_2;
import ttw.tradefinder.zf_1;

/*
 * Renamed from ttw.tradefinder.GD
 */
public class gd_0
extends ad_2 {
    private final K D;
    private la_2 A;
    private final Object C;
    private final K M;
    private Map<String, pb_2> b;
    private Map<String, pb_2> c;

    @Override
    public void a() {
        gd_0 a2;
        gd_0 gd_02 = a2;
        super.a();
        gd_02.D.E();
        gd_02.M.E();
    }

    private /* synthetic */ void E(zf_1 a2, double a3, DecimalFormat a4) {
        if (Double.isNaN(a3)) {
            a2.E(ra_1.E("Y\u007fY"));
            return;
        }
        a2.E(a4.format(a3));
    }

    private /* synthetic */ void h(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((Oa)a4.M).J));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new pc_2(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel(ra_1.E("  \u001d5\u00137\u0006r8;\u0005'\u001d6\u001d&\r")), (Component)serializable, qE.E(af.h, a3));
    }

    private /* synthetic */ void B(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(0, Math.min(1000, ((Oa)a4.M).b));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 1000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new ka_0(a5, jSpinner, a4, (ze_2)a3));
        int n3 = Math.max(0, Math.min(1000, ((Oa)a4.M).i));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new cc_2(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0, 1000, 1);
        a2.j(new JLabel(fg_0.E("4Y=6<s\u0006s\u001c6\u0016d\u001f{")), (Component)jSpinner, qE.E(af.E, a3));
        a2.j(new JLabel(ra_1.E("\u0016;\u001fT\u001e\u0011$\u0011>T&\u001b")), (Component)serializable, qE.E(af.a, a3));
    }

    private /* synthetic */ void m(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        Object object;
        gd_0 a5;
        a4 = new zf_1(fg_0.E(";];"), ra_1.E("5!\u001fhT"));
        zf_1 zf_12 = new zf_1(fg_0.E(";];"), ra_1.E("6;\u0010hT"));
        DecimalFormat decimalFormat = new DecimalFormat(a3.a(1));
        JButton jButton = new JButton(fg_0.E("%f\u0014w\u0004s"));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.j((Component)jButton, (Component)zf_12, (Component)a4));
        a2 = a5.C;
        synchronized (a2) {
            if (a5.A == null) {
                return;
            }
        }
        a2 = a5.A.E(a3.M);
        if (a2 instanceof oc_2 && !a5.c.containsKey(a3.M)) {
            object = (oc_2)a2;
            a5.c.put(a3.M, ((oc_2)object).E());
        }
        if (a5.c.containsKey(a3.M)) {
            object = a5.c.get(a3.M);
            gd_0 gd_02 = a5;
            gd_02.E((zf_1)a4, ((pb_2)object).M, decimalFormat);
            gd_02.E(zf_12, ((pb_2)object).b, decimalFormat);
        }
        jButton.addActionListener(new pc_1(a5, a3, (zf_1)a4, decimalFormat, zf_12));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        gd_0 a6;
        gd_0 gd_02 = a6;
        a5 = gd_02.E().E(fg_0.E("$B';<\u007f\u0001c\u0019r\u0019b\tB\u0002w\u0013}\u0015d"), a2.M, new Oa(a2.A));
        df_0<va_0, f> df_02 = gd_02.E().E(ra_1.E("\u0006 \u0005Y\u001e\u001d#\u0001;\u0010;\u0000+  \u00151\u001f7\u0006"), a2.M, new va_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.s) {
            a6.i(a3, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.ga) {
            a6.f(a3, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.i) {
            sc_1 sc_12 = a3;
            a6.h(sc_12, a2, (df_0<Oa, et>)a5);
            a6.B(sc_12, a2, (df_0<Oa, et>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.h) && a6.E().j()) {
            gd_0 gd_03 = a6;
            sc_1 sc_13 = a3;
            a6.c(sc_13, a2, (df_0<Oa, et>)a5);
            gd_03.H(sc_13, a2, (df_0<Oa, et>)a5);
            gd_03.a(a3, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.u) {
            sc_1 sc_14 = a3;
            a6.C(sc_14, a2, (df_0<Oa, et>)a5);
            a6.l(sc_14, a2, (df_0<Oa, et>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.w) && a6.E().j()) {
            gd_0 gd_04 = a6;
            sc_1 sc_15 = a3;
            a6.g(sc_15, a2, (df_0<Oa, et>)a5);
            gd_04.E(sc_15, a2, (df_0<Oa, et>)a5);
            gd_04.F(a3, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.U) {
            sc_1 sc_16 = a3;
            a6.M(sc_16, a2, (df_0<Oa, et>)a5);
            a6.D(sc_16, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.R) {
            sc_1 sc_17 = a3;
            a6.j(sc_17, a2, (df_0<Oa, et>)a5);
            a6.m(sc_17, a2, (df_0<Oa, et>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.V) {
            gd_0 gd_05 = a6;
            gd_05.e(a3, a2, (df_0<Oa, et>)a5);
            if (gd_05.M.j()) {
                gd_0 gd_06 = a6;
                gd_06.d(a3, a2, (df_0<Oa, et>)a5);
                gd_06.J(a3, a2, (df_0<Oa, et>)a5);
            }
        }
        if (a4 == nf_0.O || a4 == nf_0.Y) {
            a6.A(a3, a2, df_02);
        }
        return arrayList;
    }

    private /* synthetic */ void i(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        JCheckBox jCheckBox = new JCheckBox(fg_0.E("5x\u0011t\u001cs"));
        jCheckBox.setSelected(((Oa)a4.M).j);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((Oa)a4.M).j);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new WE(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    public gd_0(f_0 a2) {
        gd_0 a3;
        gd_0 gd_02 = a3;
        gd_0 gd_03 = a3;
        super(a2, fg_0.E("$B';<\u007f\u0001c\u0019r\u0019b\tB\u0002w\u0013}\u0015d"));
        gd_03.C = new Object();
        gd_02.A = null;
        gd_03.b = new HashMap<String, pb_2>();
        gd_02.c = new HashMap<String, pb_2>();
        Pc pc = new Pc(ra_1.E("\u0017\f&\u0011<\u00107\u0010\u0001\u001b'\u001a67=\u001a4\u001d5\u0001 \u0015&\u001d=\u001a"), Arrays.asList(cd.C, cd.c, cd.D), a2.E());
        gd_0 gd_04 = a3;
        gd_04.D = pc.E(null);
        gd_04.M = new Pc(fg_0.E("&y\u001cc\u001ds3~\u0011x\u0017s4s\u0006Z\u0019u\u0015x\u0003s"), Collections.emptyList(), a2.E()).E(null);
    }

    private /* synthetic */ void M(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(0, Math.min(1000, ((Oa)a4.M).H));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 1000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new MF(a5, jSpinner, a4, (ze_2)a3));
        int n3 = Math.max(0, Math.min(1000, ((Oa)a4.M).D));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new fc_2(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0, 1000, 1);
        a2.j(new JLabel(fg_0.E("4Y=6<s\u0006s\u001c6\u0016d\u001f{")), (Component)jSpinner, qE.E(af.b, a3));
        a2.j(new JLabel(ra_1.E("\u0016;\u001fT\u001e\u0011$\u0011>T&\u001b")), (Component)serializable, qE.E(af.H, a3));
    }

    public void E(la_2 a2) {
        gd_0 a3;
        Object object = a3.C;
        synchronized (object) {
            a3.A = a2;
            return;
        }
    }

    private /* synthetic */ void D(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        Object object;
        gd_0 a5;
        a4 = new zf_1(ra_1.E("Y\u007fY"), fg_0.E("W\u0003}J6"));
        zf_1 zf_12 = new zf_1(ra_1.E("Y\u007fY"), fg_0.E("T\u0019rJ6"));
        DecimalFormat decimalFormat = new DecimalFormat(a3.a(1));
        JButton jButton = new JButton(ra_1.E("\u0007\u00046\u0015&\u0011"));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.j((Component)jButton, (Component)zf_12, (Component)a4));
        a2 = a5.C;
        synchronized (a2) {
            if (a5.A == null) {
                return;
            }
        }
        a2 = a5.A.E(a3.M);
        if (a2 instanceof oc_2 && !a5.b.containsKey(a3.M)) {
            object = (oc_2)a2;
            a5.b.put(a3.M, ((oc_2)object).E());
        }
        if (a5.b.containsKey(a3.M)) {
            object = a5.b.get(a3.M);
            gd_0 gd_02 = a5;
            gd_02.E((zf_1)a4, ((pb_2)object).A, decimalFormat);
            gd_02.E(zf_12, ((pb_2)object).C, decimalFormat);
        }
        jButton.addActionListener(new ra_2(a5, a3, (zf_1)a4, decimalFormat, zf_12));
    }

    private /* synthetic */ void F(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2;
        String string = ee.E(((Oa)a4.M).F);
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
        jComboBox2.addActionListener(new Xf(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ra_1.E("6=\u001b9\u00193\u0004r5>\u0011 \u0000r97\u0007!\u00155\u0011")), jComboBox));
    }

    @Override
    public kc_2 E(f_0 a2, ze_2 a3, xf_2 a4) {
        gd_0 a5;
        return new gb_2(ra_1.E("\u0006 \u0005Y\u001e\u001d#\u0001;\u0010;\u0000+  \u00151\u001f7\u0006"), a2, a3, a4, a5);
    }

    private /* synthetic */ void c(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        if (!a5.E().j()) {
            return;
        }
        aa_2 aa_22 = new aa_2(a5, a3, a4);
        if (!a5.D.E(a3.j)) {
            yf_2.E(a2, ((Oa)a4.M).B, aa_22);
            return;
        }
        yf_2.E(a3.M, a2, ((Oa)a4.M).B, aa_22);
    }

    private /* synthetic */ void J(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(1, Math.min(120, ((Oa)a4.M).c));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 120, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new td_0(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 120, 1);
        a2.j(new JLabel(ra_1.E("\"=\u0018'\u00197T\u0002\u0011 \u001d=\u0010r/!)")), (Component)serializable, qE.E(af.A, a3));
    }

    private /* synthetic */ void e(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        JCheckBox jCheckBox = new JCheckBox(fg_0.E("5x\u0011t\u001cs"));
        jCheckBox.setSelected(((Oa)a4.M).h);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((Oa)a4.M).h);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new sf(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void C(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((Oa)a4.M).K));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new vc_2(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel(ra_1.E("  \u001d5\u00137\u0006r8;\u0005'\u001d6\u001d&\r")), (Component)serializable, qE.E(af.D, a3));
    }

    private /* synthetic */ void g(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        if (!a5.E().j()) {
            return;
        }
        ld_2 ld_22 = new ld_2(a5, a3, a4);
        if (!a5.D.E(a3.j)) {
            yf_2.E(a2, ((Oa)a4.M).d, ld_22);
            return;
        }
        yf_2.E(a3.M, a2, ((Oa)a4.M).d, ld_22);
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        JCheckBox jCheckBox = new JCheckBox(fg_0.E("5x\u0011t\u001cs"));
        jCheckBox.setSelected(((Oa)a4.M).a);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((Oa)a4.M).a);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new tc_2(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(0, Math.min(1000, ((Oa)a4.M).C));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 1000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new KF(a5, jSpinner, a4, (ze_2)a3));
        int n3 = Math.max(0, Math.min(1000, ((Oa)a4.M).M));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new Mg(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0, 1000, 1);
        a2.j(new JLabel(fg_0.E("4Y=6<s\u0006s\u001c6\u0016d\u001f{")), (Component)jSpinner, qE.E(af.c, a3));
        a2.j(new JLabel(ra_1.E("\u0016;\u001fT\u001e\u0011$\u0011>T&\u001b")), (Component)serializable, qE.E(af.B, a3));
    }

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        int n2;
        gd_0 a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((Oa)a4.M).A);
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
        jComboBox2.addActionListener(new lb_1(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(fg_0.E("#s\u001erPB\u0015z\u0015q\u0002w\u001d6>y\u0004\u007f\u0016\u007f\u0013w\u0004\u007f\u001fx")), jComboBox));
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<va_0, f> a4) {
        gd_0 a5;
        JCheckBox jCheckBox = new JCheckBox(fg_0.E("5x\u0011t\u001cs"));
        jCheckBox.setSelected(((va_0)a4.M).c);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((va_0)a4.M).c);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new ca_2(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(0, Math.min(1000, ((Oa)a4.M).e));
        SpinnerNumberModel spinnerNumberModel = new SpinnerNumberModel(n2, 0, 1000, 1);
        JSpinner jSpinner = new JSpinner(spinnerNumberModel);
        jSpinner.addChangeListener(new Ye(a5, jSpinner, a4, (ze_2)a3));
        int n3 = Math.max(0, Math.min(1000, ((Oa)a4.M).k));
        Serializable serializable = new SpinnerNumberModel(n3, 0, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new Bg(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0, 1000, 1);
        a2.j(new JLabel(ra_1.E("\u0016;\u001fT\u001e\u0011$\u0011>T4\u0006=\u0019")), (Component)jSpinner, qE.E(af.C, a3));
        a2.j(new JLabel(fg_0.E("4Y=6<s\u0006s\u001c6\u0004y")), (Component)serializable, qE.E(af.j, a3));
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2;
        String string = ee.E(((Oa)a4.M).f);
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
        jComboBox2.addActionListener(new nd_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ra_1.E("6=\u001b9\u00193\u0004r5>\u0011 \u0000r97\u0007!\u00155\u0011")), jComboBox));
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        gd_0 a5;
        int n2 = Math.max(1, Math.min(120, ((Oa)a4.M).G));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 120, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new dd_0(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 120, 1);
        a2.j(new JLabel(fg_0.E(" s\u0002\u007f\u001frPM\u0003K")), (Component)serializable, qE.E(af.K, a3));
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<Oa, et> a4) {
        int n2;
        gd_0 a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((Oa)a4.M).E);
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
        jComboBox2.addActionListener(new Xe(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(fg_0.E("#s\u001erPB\u0015z\u0015q\u0002w\u001d6>y\u0004\u007f\u0016\u007f\u0013w\u0004\u007f\u001fx")), jComboBox));
    }
}

