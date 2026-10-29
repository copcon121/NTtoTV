/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dialog;
import java.awt.Window;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.function.Consumer;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.K;
import ttw.tradefinder.Oc;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ae_0;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cc_1;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.hc_1;
import ttw.tradefinder.hc_2;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.in;
import ttw.tradefinder.j_0;
import ttw.tradefinder.le_1;
import ttw.tradefinder.nc_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.qE;
import ttw.tradefinder.qd_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sa_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.va_2;
import ttw.tradefinder.vb_2;
import ttw.tradefinder.xb_0;
import ttw.tradefinder.xc_2;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.yc_2;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.zb_2;
import ttw.tradefinder.ze_2;
import velox.gui.colors.ColorsConfigItem;

/*
 * Renamed from ttw.tradefinder.OB
 */
public class ob_1
extends ib_2 {
    private final K A;
    private Map<String, JDialog> C;
    private Object M;
    private final K b;
    private int c;

    private /* synthetic */ void e(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        if (!a5.ttw_tradefinder_f_0_E().boolean_j()) {
            return;
        }
        cc_1 cc_12 = new cc_1(a5, a3, a4);
        if (!a5.b.E(a3.j)) {
            yf_2.E(a2, ((ua_0)a4.M).C, cc_12);
            return;
        }
        yf_2.E(a3.M, a2, ((ua_0)a4.M).C, cc_12);
    }

    @Override
    public void void_E(String a2) {
        ob_1 a3;
        ob_1 ob_12 = a3;
        super.void_E((String)a2);
        Object object = ob_12.M;
        synchronized (object) {
            if (a3.C.containsKey(a2)) {
                a2 = a3.C.remove(a2);
                ((Dialog)a2).setVisible(false);
                ((Window)a2).dispose();
            }
            return;
        }
    }

    private /* synthetic */ void C(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 ob_12;
        boolean bl;
        ob_1 a5;
        if (!a5.A.E(a3.j)) {
            return;
        }
        JButton jButton = new JButton(Oc.E("t\u0007A\rC\u0005A\u0001\u0015,\\\u0000Q\u0001[Dz\u0016Q\u0001GD{\u0005C\rR\u0005A\u000bG"));
        c_0 c_02 = a5.ttw_tradefinder_c_0_E(a3.M);
        if (c_02 == null || !(c_02 instanceof yc_2)) {
            return;
        }
        c_02 = (yc_2)c_02;
        sc_1 sc_12 = a2;
        jButton.addActionListener(new nc_2(a5, a4, a3, (yc_2)c_02));
        a5.c = sc_12.j((Component)jButton, qE.E(ae_0.M));
        if (((ua_0)a4.M).D != df_1.c) {
            bl = true;
            ob_12 = a5;
        } else {
            bl = false;
            ob_12 = a5;
        }
        sc_12.E(bl, ob_12.c);
    }

    private /* synthetic */ void g(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        int n2;
        ob_1 a5;
        if (!a5.A.E(a3.j)) {
            return;
        }
        String string = ee.E(((ua_0)a4.M).D);
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
        jComboBox2.addActionListener(new vb_2(a5, jComboBox, a4, a3, a2));
        a2.a(new JLabel(le_1.E("\b=4\"{479{\u0001)480(")), jComboBox);
    }

    private /* synthetic */ void f(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        JLabel jLabel = new JLabel(Integer.toString(((ua_0)a4.M).H) + " %");
        int n2 = Math.max(5, Math.min(100, ((ua_0)a4.M).H));
        JSlider jSlider = new JSlider(0, 5, 100, n2);
        jSlider.addChangeListener(new va_2(a5, a4, jLabel, a3));
        a2.E(new JLabel(Oc.E("0G\rR\u0003P\u0016\u0015\u0017\\\u001eP")), jLabel, jSlider, qE.E(ae_0.h));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        ob_1 a6;
        a5 = a6.ttw_tradefinder_f_0_E().E(a6.ttw_tradefinder_r_0_E().f(), a2.M, new ua_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.java_lang_String_E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.C) {
            a6.j(a3, a2, (df_0<ua_0, in>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.e) {
            a6.C(a3, a2, (df_0<ua_0, in>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.a) {
            sc_1 sc_12 = a3;
            ze_2 ze_22 = a2;
            ob_1 ob_12 = a6;
            sc_1 sc_13 = a3;
            a6.f(sc_13, a2, (df_0<ua_0, in>)a5);
            ob_12.a(sc_13, a2, (df_0<ua_0, in>)a5);
            ob_12.d(a3, a2, (df_0<ua_0, in>)a5);
            a6.H(a3, ze_22, (df_0<ua_0, in>)a5);
            a6.A(sc_12, ze_22, (df_0<ua_0, in>)a5);
            a6.g(sc_12, a2, (df_0<ua_0, in>)a5);
        }
        if ((a4 == nf_0.O || a4 == nf_0.m) && a6.ttw_tradefinder_f_0_E().boolean_j()) {
            ob_1 ob_13 = a6;
            sc_1 sc_14 = a3;
            a6.e(sc_14, a2, (df_0<ua_0, in>)a5);
            ob_13.l(sc_14, a2, (df_0<ua_0, in>)a5);
            ob_13.E(a3, a2, (df_0<ua_0, in>)a5);
        }
        return arrayList;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        ob_1 a5;
        a2 = new yc_2(a5.ttw_tradefinder_r_0_E().f(), (f_0)a2, a3, a5);
        ob_1 ob_12 = a5;
        ze_2 ze_22 = a3;
        a5.a(ze_22.M, a5.ttw_tradefinder_r_0_E().ttw_tradefinder_ff_1_E(), (j_0)a2);
        ob_12.a(ze_22.M, ff_1.g, (j_0)a2);
        ob_12.a(a3.M, ff_1.e, (j_0)a2);
        return a2;
    }

    private /* synthetic */ void l(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        int n2;
        ob_1 a5;
        if (!a5.ttw_tradefinder_f_0_E().ttw_tradefinder_ed_2_E().E(a3.j)) {
            return;
        }
        String string = ee.E(((ua_0)a4.M).h);
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
        jComboBox2.addActionListener(new qd_0(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(le_1.E("\u0006>;?u\u000f070<':8{\u001b4!2326:!2:5")), jComboBox));
    }

    public void H(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        a3 = new ColorsConfigItem(((ua_0)a4.M).b, ((ua_0)a4.M).b, (Consumer)new xb_0(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.E(new JLabel(Oc.E("a\u0016T\u0007PDV\u000bY\u000bGDw\rQ")), (Component)((Object)a3)));
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        int n2;
        String string = ee.E(((ua_0)a4.M).a);
        String[] stringArray = ee.E(uc_2.M).toArray(new String[0]);
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
        jComboBox2.addActionListener(new hc_1(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.j(new JLabel(le_1.E("\u0011>&225")), jComboBox, qE.E(ae_0.D)));
    }

    public void d(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        a3 = new ColorsConfigItem(((ua_0)a4.M).c, ((ua_0)a4.M).c, (Consumer)new zb_2(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.E(new JLabel(le_1.E("\u000f':6>u8:7:)u\u001a&0")), (Component)((Object)a3)));
    }

    @Override
    public void a() {
        ob_1 a2;
        ob_1 ob_12 = a2;
        super.a();
        ob_12.A.void_E();
        ob_12.b.void_E();
        Object object = ob_12.M;
        synchronized (object) {
            Iterator<JDialog> iterator;
            Iterator<JDialog> iterator2 = iterator = a2.C.values().iterator();
            while (iterator2.hasNext()) {
                iterator.next().dispose();
                iterator2 = iterator;
            }
            a2.C.clear();
            return;
        }
    }

    public ob_1(f_0 a2, r_0 a3) {
        ob_1 a4;
        ob_1 ob_12 = a4;
        super(a2, (r_0)a3);
        ob_12.C = new HashMap<String, JDialog>();
        ob_12.M = new Object();
        ob_12.c = -1;
        a3 = new Pc(le_1.E("\u001d21?05\u001a)1>'\u001f0-\u0006>!/<52("), Collections.singletonList(cd.C), Arrays.asList(dd_1.c), a2.ttw_tradefinder_qc_1_E());
        ob_1 ob_13 = a4;
        ob_13.A = a3.E(null);
        ob_13.b = new Pc(Oc.E("1Y\u0010G\u0005e\u0005G\u0005X\u0001A\u0001G2\\\u0017\\\u0006\\\b\\\u0010L"), Arrays.asList(cd.C, cd.c, cd.D), a2.ttw_tradefinder_qc_1_E()).E(null);
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        int n2 = Math.max(8, Math.min(18, ((ua_0)a4.M).M));
        JSlider jSlider = new JSlider(0, 8, 18, n2);
        jSlider.addChangeListener(new xc_2(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(Oc.E("a\u0001M\u0010\u0015\u0017\\\u001eP")), (Component)jSlider));
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        JCheckBox jCheckBox = new JCheckBox(le_1.E("\u00105499>"));
        jCheckBox.setSelected(((ua_0)a4.M).j);
        sc_1 sc_12 = a2;
        sc_12.void_E(jCheckBox);
        sc_12.E(((ua_0)a4.M).j);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new sa_2(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<ua_0, in> a4) {
        ob_1 a5;
        int n2;
        String string = ee.E(((ua_0)a4.M).A);
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
        jComboBox2.addActionListener(new hc_2(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(Oc.E("w\u000bZ\u000fX\u0005EDt\bP\u0016ADx\u0001F\u0017T\u0003P")), jComboBox));
    }
}

