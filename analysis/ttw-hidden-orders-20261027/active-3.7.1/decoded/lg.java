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
import ttw.tradefinder.Bf;
import ttw.tradefinder.CF;
import ttw.tradefinder.Fe;
import ttw.tradefinder.Gg;
import ttw.tradefinder.Hf;
import ttw.tradefinder.JE;
import ttw.tradefinder.Jg;
import ttw.tradefinder.K;
import ttw.tradefinder.KB;
import ttw.tradefinder.ME;
import ttw.tradefinder.Ob;
import ttw.tradefinder.Pc;
import ttw.tradefinder.Re;
import ttw.tradefinder.TE;
import ttw.tradefinder.VF;
import ttw.tradefinder.WF;
import ttw.tradefinder.Wa;
import ttw.tradefinder.XD;
import ttw.tradefinder.ZD;
import ttw.tradefinder.aE;
import ttw.tradefinder.ad_2;
import ttw.tradefinder.b;
import ttw.tradefinder.cd;
import ttw.tradefinder.cd_1;
import ttw.tradefinder.cf_0;
import ttw.tradefinder.cg;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.ep;
import ttw.tradefinder.fR;
import ttw.tradefinder.f_0;
import ttw.tradefinder.fd_1;
import ttw.tradefinder.fd_2;
import ttw.tradefinder.fu;
import ttw.tradefinder.g;
import ttw.tradefinder.gd_1;
import ttw.tradefinder.ge;
import ttw.tradefinder.h;
import ttw.tradefinder.hf_0;
import ttw.tradefinder.i;
import ttw.tradefinder.ie;
import ttw.tradefinder.iy;
import ttw.tradefinder.jf;
import ttw.tradefinder.kc_2;
import ttw.tradefinder.ke;
import ttw.tradefinder.ke_0;
import ttw.tradefinder.lF;
import ttw.tradefinder.lf_0;
import ttw.tradefinder.md_1;
import ttw.tradefinder.mf_0;
import ttw.tradefinder.nE;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.oF;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.pe;
import ttw.tradefinder.pe_0;
import ttw.tradefinder.qE;
import ttw.tradefinder.q_0;
import ttw.tradefinder.rF;
import ttw.tradefinder.ra;
import ttw.tradefinder.rd_1;
import ttw.tradefinder.sa_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sd_0;
import ttw.tradefinder.ta_0;
import ttw.tradefinder.td_1;
import ttw.tradefinder.uD;
import ttw.tradefinder.ua;
import ttw.tradefinder.uf;
import ttw.tradefinder.uf_0;
import ttw.tradefinder.uf_1;
import ttw.tradefinder.uf_2;
import ttw.tradefinder.wD;
import ttw.tradefinder.wd_0;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.xe_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ye_0;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.zF;
import ttw.tradefinder.zd_0;
import ttw.tradefinder.ze_2;

public class lg
extends ad_2 {
    private final K b;
    private final K c;

    private /* synthetic */ void n(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        lg a5;
        if (!a5.E().j()) {
            return;
        }
        Re re = new Re(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((Ob)a4.M).A, re);
            return;
        }
        yf_2.E(a3.M, a2, ((Ob)a4.M).A, re);
    }

    private /* synthetic */ void W(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        lg a5;
        int n2 = Math.max(1, Math.min(1000, ((pa_0)a4.M).H));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new hf_0(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 1000, 1);
        a2.j(new JLabel("Price Range [ticks/cents]"), (Component)serializable, qE.E(cf_0.h, a3));
    }

    @Override
    public void a() {
        lg a2;
        lg lg2 = a2;
        super.a();
        lg2.b.E();
        lg2.c.E();
    }

    private /* synthetic */ void v(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        lg a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((xa_0)a4.M).M));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new td_1(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel("Signal Level"), (Component)serializable, qE.E(cf_0.B, a3));
    }

    private /* synthetic */ void N(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        lg a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((ra)a4.M).c));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new md_1(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel("Trigger Volume"), (Component)serializable, qE.E(cf_0.j, a3));
    }

    private /* synthetic */ void w(sc_1 a2, ze_2 a3, df_0<sa_0, h> a4) {
        lg a5;
        if (!a5.c.j()) {
            return;
        }
        int n2 = Math.max(1, Math.min(60, ((sa_0)a4.M).A));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 60, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, ze_2.E((Object)"\u0016"));
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new ge(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 60, 1);
        a2.j(new JLabel("Sum-Up Time[s]"), (Component)serializable, qE.E(cf_0.D, a3));
    }

    private /* synthetic */ void o(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((pa_0)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((pa_0)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new pe_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        a5 = new uD(a6, a3, (String)a5, a4);
        if (!a6.b.E(a3.j)) {
            yf_2.E(a2, ((Wa)a4.M).M, (q_0)a5);
            return;
        }
        yf_2.E(a3.M, a2, ((Wa)a4.M).M, (q_0)a5);
    }

    @Override
    public kc_2 E(f_0 a2, ze_2 a3, xf_2 a4) {
        lg a5;
        return new gd_1(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), a2, a3, a4, a5);
    }

    private /* synthetic */ void t(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        lg a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((pa_0)a4.M).c));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new wd_0(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel(ze_2.E((Object)"aG\\RRPG\u0015cZY@XP")), (Component)serializable, qE.E(cf_0.C, a3));
    }

    private /* synthetic */ void y(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        int n2;
        String string = ee.E(((ua)a4.M).b);
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
        jComboBox2.addActionListener(new fd_2(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"wZZ^XTE\u0015tYPGA\u0015xPFFTRP")), jComboBox));
    }

    private /* synthetic */ void Q(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        int n2;
        lg a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((Ob)a4.M).h);
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
        jComboBox2.addActionListener(new XD(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Send Telegram Notification"), jComboBox));
    }

    private /* synthetic */ void x(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox(ze_2.E((Object)"p[TWYP"));
        jCheckBox.setSelected(((xa_0)a4.M).D);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((xa_0)a4.M).D);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new uf_1(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void Z(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        int n2;
        lg a5;
        if (!a5.c.j()) {
            return;
        }
        String string = ee.E(((pa_0)a4.M).h);
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
        jComboBox2.addActionListener(new Bf(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"fAZE\u0015aGTVPF")), jComboBox));
    }

    private /* synthetic */ void O(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((Ob)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((Ob)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new Fe(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void z(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        lg a5;
        int n2;
        String string = ee.E(((Ob)a4.M).C);
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
        jComboBox2.addActionListener(new uf_2(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"wZZ^XTE\u0015tYPGA\u0015xPFFTRP")), jComboBox));
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        int n2 = Math.max(0, Math.min(100, ((Wa)a4.M).D));
        Serializable serializable = new SpinnerNumberModel(n2, 0, 100, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, ze_2.E((Object)"\u0016"));
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new cg(a6, (JSpinner)serializable, a4, (ze_2)a3, a5));
        a3 = qE.E(0, 100, 1);
        a2.j(new JLabel("Pullback Price Change [ticks/cents]"), (Component)serializable, qE.E(cf_0.H, a3));
    }

    private /* synthetic */ void u(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        int n2;
        lg a5;
        if (!a5.c.j()) {
            return;
        }
        String string = ee.E(((pa_0)a4.M).C);
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
        jComboBox2.addActionListener(new WF(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Show OrderId"), jComboBox));
    }

    private /* synthetic */ void K(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        lg a5;
        int n2 = Math.max(1, Math.min(1000, ((ra)a4.M).M));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new aE(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 1000, 1);
        a2.j(new JLabel(ze_2.E((Object)"eG\\VP\u0015gT[RP\u0015nA\\V^F\u001aVP[AFh")), (Component)serializable, qE.E(cf_0.e, a3));
    }

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        int n2;
        String string = ee.E(((Wa)a4.M).b);
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
        jComboBox2.addActionListener(new cd_1(a6, jComboBox, a4, a3, a5));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Bookmap Alert Message"), jComboBox));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        lg a6;
        lg lg2 = a6;
        a5 = lg2.E().E("TTW-MarketExplorer", a2.M, new ua(a2.A));
        df_0<pa_0, fu> df_02 = lg2.E().E(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), a2.M, new pa_0(a2.A));
        df_0<ra, b> df_03 = lg2.E().E("TTW-MarketExplorer", a2.M, new ra(a2.A));
        df_0<Ob, fR> df_04 = lg2.E().E(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), a2.M, new Ob(a2.A));
        df_0<Wa, iy> df_05 = lg2.E().E("TTW-MarketExplorer", a2.M, ze_2.E((Object)"\u0004"), new Wa(a2.A));
        df_0<Wa, iy> df_06 = lg2.E().E("TTW-MarketExplorer", a2.M, ze_2.E((Object)"\u0007"), new Wa(a2.A));
        df_0<xa_0, i> df_07 = lg2.E().E("TTW-MarketExplorer", a2.M, new xa_0(a2.A));
        df_0<sa_0, h> df_08 = lg2.E().E(ze_2.E((Object)"aab\u0018xTG^PApMEYZGPG"), a2.M, new sa_0());
        df_0<ta_0, g> df_09 = lg2.E().E("TTW-MarketExplorer", a2.M, new ta_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.C) {
            a6.M(a3, a2, (df_0<ua, ep>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.k) {
            sc_1 sc_12 = a3;
            ze_2 ze_22 = a2;
            a6.H(a3, a2, (df_0<ua, ep>)a5);
            a6.L(a3, ze_22, (df_0<ua, ep>)a5);
            a6.f(sc_12, ze_22, (df_0<ua, ep>)a5);
            a6.E(sc_12, a2, (df_0<ua, ep>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.m) && a6.E().j()) {
            lg lg3 = a6;
            sc_1 sc_13 = a3;
            a6.a(sc_13, a2, (df_0<ua, ep>)a5);
            lg3.I(sc_13, a2, (df_0<ua, ep>)a5);
            lg3.y(a3, a2, (df_0<ua, ep>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.Ha) {
            a6.A(a3, a2, df_05, ze_2.E((Object)"\u0004"));
        }
        if (a4 == nf_0.O || a4 == nf_0.Z) {
            sc_1 sc_14 = a3;
            ze_2 ze_23 = a2;
            a6.d(a3, a2, df_05, "1");
            a6.E(a3, ze_23, df_05, ze_2.E((Object)"\u0004"));
            a6.j(sc_14, ze_23, df_05, "1");
            a6.l(sc_14, a2, df_05, ze_2.E((Object)"\u0004"));
        }
        if ((a4 == nf_0.O || a4 == nf_0.G) && a6.E().j()) {
            lg lg4 = a6;
            sc_1 sc_15 = a3;
            a6.f(sc_15, a2, df_05, "1");
            lg4.a(sc_15, a2, df_05, ze_2.E((Object)"\u0004"));
            lg4.H(a3, a2, df_05, "1");
        }
        if (a4 == nf_0.O || a4 == nf_0.f) {
            a6.A(a3, a2, df_06, ze_2.E((Object)"\u0007"));
        }
        if (a4 == nf_0.O || a4 == nf_0.N) {
            sc_1 sc_16 = a3;
            ze_2 ze_24 = a2;
            a6.d(a3, a2, df_06, "2");
            a6.E(a3, ze_24, df_06, ze_2.E((Object)"\u0007"));
            a6.j(sc_16, ze_24, df_06, "2");
            a6.l(sc_16, a2, df_06, ze_2.E((Object)"\u0007"));
        }
        if ((a4 == nf_0.O || a4 == nf_0.A) && a6.E().j()) {
            lg lg5 = a6;
            sc_1 sc_17 = a3;
            a6.f(sc_17, a2, df_06, "2");
            lg5.a(sc_17, a2, df_06, ze_2.E((Object)"\u0007"));
            lg5.H(a3, a2, df_06, "2");
        }
        if (a4 == nf_0.O || a4 == nf_0.y) {
            a6.x(a3, a2, df_07);
        }
        if (a4 == nf_0.O || a4 == nf_0.t) {
            a6.v(a3, a2, df_07);
        }
        if (a4 == nf_0.O || a4 == nf_0.l) {
            a6.m(a3, a2, df_07);
        }
        if ((a4 == nf_0.O || a4 == nf_0.D) && a6.E().j()) {
            lg lg6 = a6;
            sc_1 sc_18 = a3;
            a6.e(sc_18, a2, df_07);
            lg6.G(sc_18, a2, df_07);
            lg6.d(a3, a2, df_07);
        }
        if (a4 == nf_0.O || a4 == nf_0.j) {
            a6.o(a3, a2, df_02);
        }
        if (a4 == nf_0.O || a4 == nf_0.Q) {
            sc_1 sc_19 = a3;
            ze_2 ze_25 = a2;
            a6.t(a3, a2, df_02);
            a6.W(a3, ze_25, df_02);
            a6.u(sc_19, ze_25, df_02);
            a6.Z(sc_19, a2, df_02);
        }
        if ((a4 == nf_0.O || a4 == nf_0.X) && a6.E().j()) {
            lg lg7 = a6;
            sc_1 sc_110 = a3;
            a6.l(sc_110, a2, df_02);
            lg7.A(sc_110, a2, df_02);
            lg7.c(a3, a2, df_02);
        }
        if (a4 == nf_0.O || a4 == nf_0.p) {
            a6.B(a3, a2, df_03);
        }
        if (a4 == nf_0.O || a4 == nf_0.I) {
            sc_1 sc_111 = a3;
            a6.N(sc_111, a2, df_03);
            a6.K(sc_111, a2, df_03);
        }
        if ((a4 == nf_0.O || a4 == nf_0.S) && a6.E().j()) {
            lg lg8 = a6;
            sc_1 sc_112 = a3;
            a6.h(sc_112, a2, df_03);
            lg8.J(sc_112, a2, df_03);
            lg8.D(a3, a2, df_03);
        }
        if (a4 == nf_0.O || a4 == nf_0.v) {
            a6.O(a3, a2, df_04);
        }
        if (a4 == nf_0.O || a4 == nf_0.P) {
            sc_1 sc_113 = a3;
            a6.g(sc_113, a2, df_04);
            a6.b(sc_113, a2, df_04);
        }
        if ((a4 == nf_0.O || a4 == nf_0.x) && a6.E().j()) {
            lg lg9 = a6;
            sc_1 sc_114 = a3;
            a6.n(sc_114, a2, df_04);
            lg9.Q(sc_114, a2, df_04);
            lg9.z(a3, a2, df_04);
        }
        if (a4 == nf_0.O || a4 == nf_0.Ca) {
            sc_1 sc_115 = a3;
            a6.k(sc_115, a2, df_08);
            a6.i(sc_115, a2, df_08);
        }
        if (a4 == nf_0.O || a4 == nf_0.n) {
            sc_1 sc_116 = a3;
            a6.j(sc_116, a2, df_08);
            a6.w(sc_116, a2, df_08);
        }
        if (a4 == nf_0.O || a4 == nf_0.W) {
            a6.C(a3, a2, df_09);
        }
        if (a4 == nf_0.O || a4 == nf_0.da) {
            a6.F(a3, a2, df_09);
        }
        return arrayList;
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((Wa)a4.M).H);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((Wa)a4.M).H);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new pe(a6, jCheckBox, a4, a2, a3, a5));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        double d2;
        String string = ((ze_2)a3).a(0);
        double d3 = d2 = 1.0 / ((ze_2)a3).A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((Wa)a4.M).h));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new sd_0(a6, (JSpinner)serializable, (df_0)a4, (ze_2)a3, a5));
        a3 = "Signal Level" + (a6.c.j() ? ze_2.E((Object)"\u0015tF^") : "");
        a4 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel((String)a3), (Component)serializable, qE.E(cf_0.A, a4));
    }

    private /* synthetic */ void I(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        int n2;
        lg a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((ua)a4.M).M);
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
        jComboBox2.addActionListener(new mf_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Send Telegram Notification"), jComboBox));
    }

    private /* synthetic */ void L(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        String string = ze_2.E((Object)"\u0016\u001b\u0016\u0016");
        double d2 = Math.max(0.01, Math.min(10000.0, ((ua)a4.M).a));
        Serializable serializable = new SpinnerNumberModel(d2, 0.01, 10000.0, 0.01);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new zF(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0.01, 10000.0, 0.01, string);
        a2.j(new JLabel("Maximum Duration [s]"), (Component)serializable, qE.E(cf_0.K, a3));
    }

    private /* synthetic */ void G(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        int n2;
        lg a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((xa_0)a4.M).b);
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
        jComboBox2.addActionListener(new ke(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"fP[Q\u0015aPYPRGTX\u0015{ZA\\S\\VTA\\Z[")), jComboBox));
    }

    private /* synthetic */ void b(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        lg a5;
        String string = "#.##";
        double d2 = Math.max(0.01, Math.min(10000.0, ((Ob)a4.M).D));
        Serializable serializable = new SpinnerNumberModel(d2, 0.01, 10000.0, 0.01);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new zd_0(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(0.01, 10000.0, 0.01, string);
        a2.j(new JLabel(ze_2.E((Object)"xTM\\X@X\u0015q@GTA\\Z[\u0015nFh")), (Component)serializable, qE.E(cf_0.k, a3));
    }

    private /* synthetic */ void k(sc_1 a2, ze_2 a3, df_0<sa_0, h> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox(ze_2.E((Object)"p[TWYP"));
        jCheckBox.setSelected(((sa_0)a4.M).c);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((sa_0)a4.M).c);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new Jg(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void h(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        lg a5;
        if (!a5.E().j()) {
            return;
        }
        oF oF2 = new oF(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((ra)a4.M).b, oF2);
            return;
        }
        yf_2.E(a3.M, a2, ((ra)a4.M).b, oF2);
    }

    private /* synthetic */ void B(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox(ze_2.E((Object)"p[TWYP"));
        jCheckBox.setSelected(((ra)a4.M).A);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((ra)a4.M).A);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new nE(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void m(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        lg a5;
        if (!a5.c.j()) {
            return;
        }
        int n2 = Math.max(1, Math.min(120, ((xa_0)a4.M).c));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 120, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, ze_2.E((Object)"\u0016"));
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new Gg(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 120, 1);
        a2.j(new JLabel("Halftime"), (Component)serializable, qE.E(cf_0.a, a3));
    }

    private /* synthetic */ void i(sc_1 a2, ze_2 a3, df_0<sa_0, h> a4) {
        lg a5;
        if (!a5.c.j()) {
            return;
        }
        int n2 = Math.max(1, Math.min(60, ((sa_0)a4.M).C));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 60, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, "#");
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new uf(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 60, 1);
        a2.j(new JLabel(ze_2.E((Object)"f@X\u0018`E\u0015a\\XPnFh")), (Component)serializable, qE.E(cf_0.b, a3));
    }

    private /* synthetic */ void M(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox(ze_2.E((Object)"p[TWYP"));
        jCheckBox.setSelected(((ua)a4.M).C);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((ua)a4.M).C);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new ie(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void D(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        lg a5;
        int n2;
        String string = ee.E(((ra)a4.M).C);
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
        jComboBox2.addActionListener(new lf_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"wZZ^XTE\u0015tYPGA\u0015xPFFTRP")), jComboBox));
    }

    private /* synthetic */ void F(sc_1 a2, ze_2 a3, df_0<ta_0, g> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((ta_0)a4.M).c);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((ta_0)a4.M).c);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new xe_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void c(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        lg a5;
        int n2;
        String string = ee.E(((pa_0)a4.M).A);
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
        jComboBox2.addActionListener(new jf(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Bookmap Alert Message"), jComboBox));
    }

    private /* synthetic */ void J(sc_1 a2, ze_2 a3, df_0<ra, b> a4) {
        int n2;
        lg a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((ra)a4.M).D);
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
        jComboBox2.addActionListener(new TE(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Send Telegram Notification"), jComboBox));
    }

    private /* synthetic */ void e(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        lg a5;
        ke_0 ke_02 = new ke_0(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((xa_0)a4.M).A, ke_02);
            return;
        }
        yf_2.E(a3.M, a2, ((xa_0)a4.M).A, ke_02);
    }

    private /* synthetic */ void C(sc_1 a2, ze_2 a3, df_0<ta_0, g> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox(ze_2.E((Object)"p[TWYP"));
        jCheckBox.setSelected(((ta_0)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((ta_0)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new uf_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void g(sc_1 a2, ze_2 a3, df_0<Ob, fR> a4) {
        lg a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((Ob)a4.M).H));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new VF(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel(ze_2.E((Object)"aG\\RRPG\u0015cZY@XP")), (Component)serializable, qE.E(cf_0.d, a3));
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        int n2 = Math.max(1, Math.min(1000, ((ua)a4.M).j));
        Serializable serializable = new SpinnerNumberModel(n2, 1, 1000, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        ((JSpinner)serializable).addChangeListener(new CF(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1, 1000, 1);
        a2.j(new JLabel(ze_2.E((Object)"eG\\VP\u0015gT[RP\u0015nA\\V^F\u001aVP[AFh")), (Component)serializable, qE.E(cf_0.E, a3));
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        lg a5;
        if (!a5.E().j()) {
            return;
        }
        rd_1 rd_12 = new rd_1(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((pa_0)a4.M).b, rd_12);
            return;
        }
        yf_2.E(a3.M, a2, ((pa_0)a4.M).b, rd_12);
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        int n2;
        lg a6;
        if (!a6.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((Wa)a4.M).c);
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
        jComboBox2.addActionListener(new ZD(a6, jComboBox, a4, a3, a5));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"fP[Q\u0015aPYPRGTX\u0015{ZA\\S\\VTA\\Z[")), jComboBox));
    }

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        double d2;
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((ua)a4.M).D));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new rF(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel("Trigger Volume"), (Component)serializable, qE.E(cf_0.M, a3));
    }

    public lg(f_0 a2) {
        super(a2, "TTW-MarketExplorer");
        lg a3;
        Pc pc = new Pc(ze_2.E((Object)"pMAP[QPQfZ@[QvZ[S\\R@GTA\\Z["), Arrays.asList(cd.C, cd.c, cd.D), a2.E());
        lg lg2 = a3;
        lg2.b = pc.E(null);
        lg2.c = new Pc("MarketAlertsDevLicense", Collections.emptyList(), a2.E()).E(null);
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<pa_0, fu> a4) {
        int n2;
        lg a5;
        if (!a5.E().E().E(a3.j)) {
            return;
        }
        String string = ee.E(((pa_0)a4.M).D);
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
        jComboBox2.addActionListener(new ME(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(ze_2.E((Object)"fP[Q\u0015aPYPRGTX\u0015{ZA\\S\\VTA\\Z[")), jComboBox));
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<xa_0, i> a4) {
        lg a5;
        int n2;
        String string = ee.E(((xa_0)a4.M).C);
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
        jComboBox2.addActionListener(new wD(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel("Bookmap Alert Message"), jComboBox));
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        if (!a5.E().j()) {
            return;
        }
        ye_0 ye_02 = new ye_0(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((ua)a4.M).H, ye_02);
            return;
        }
        yf_2.E(a3.M, a2, ((ua)a4.M).H, ye_02);
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        lg a6;
        int n2 = Math.max(0, Math.min(120, ((Wa)a4.M).A));
        Serializable serializable = new SpinnerNumberModel(n2, 0, 120, 1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, ze_2.E((Object)"\u0016"));
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new Hf(a6, (JSpinner)serializable, a4, (ze_2)a3, a5));
        a3 = qE.E(0, 120, 1);
        a2.j(new JLabel("Pullback Duration [mins]"), (Component)serializable, qE.E(cf_0.c, a3));
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<Wa, iy> a4, String a5) {
        double d2;
        lg a6;
        if (!a6.c.j()) {
            return;
        }
        String string = a3.a(0);
        double d3 = d2 = 1.0 / a3.A;
        double d4 = d2 * 1.0E8;
        double d5 = Math.max(d2, Math.min(d4, ((Wa)a4.M).C));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d4, d3);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new lF(a6, (JSpinner)serializable, a4, (ze_2)a3, a5));
        a3 = qE.E(d2, d4, d3, string);
        a2.j(new JLabel("Signal Level Bid"), (Component)serializable, qE.E(cf_0.A, a3));
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<sa_0, h> a4) {
        lg a5;
        JCheckBox jCheckBox = new JCheckBox("Enable");
        jCheckBox.setSelected(((sa_0)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((sa_0)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new fd_1(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<ua, ep> a4) {
        lg a5;
        String string = "#.#";
        double d2 = Math.max(1.0, Math.min(1000.0, ((ua)a4.M).c));
        Serializable serializable = new SpinnerNumberModel(d2, 1.0, 1000.0, 0.1);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new JE(a5, (JSpinner)serializable, a4, (ze_2)a3));
        a3 = qE.E(1.0, 1000.0, 0.1, string);
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.j(new JLabel(ze_2.E((Object)"gTA\\Z\u0015RGPTAPG\u0015\u001a\u0015PD@TY")), (Component)serializable, qE.E(cf_0.i, a3)));
    }
}

