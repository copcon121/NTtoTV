/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dialog;
import java.awt.Window;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.ab_2;
import ttw.tradefinder.af;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ee;
import ttw.tradefinder.ej;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.gd;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.ib_1;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.ja_0;
import ttw.tradefinder.jb_1;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.ma_1;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.oc_2;
import ttw.tradefinder.qE;
import ttw.tradefinder.r_0;
import ttw.tradefinder.rb_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.lA
 */
public class la_2
extends ib_2 {
    private Map<String, JDialog> M = new HashMap<String, JDialog>();
    private Object b = new Object();
    private final K c;

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        la_2 a6;
        a5 = a6.ttw_tradefinder_f_0_E().E(a6.ttw_tradefinder_r_0_E().f(), a2.M, new dc_2());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.java_lang_String_E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.q) {
            sc_1 sc_12 = a3;
            ze_2 ze_22 = a2;
            la_2 la_22 = a6;
            la_22.j(a3, a2.M, (df_0<dc_2, ej>)a5);
            la_22.E(a3, a2.M, (df_0<dc_2, ej>)a5);
            a6.a(a3, ze_22, (df_0<dc_2, ej>)a5);
            a6.E(sc_12, ze_22, (df_0<dc_2, ej>)a5);
            a6.j(sc_12, a2, (df_0<dc_2, ej>)a5);
        }
        return arrayList;
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<dc_2, ej> a4) {
        la_2 a5;
        String string = ee.E(((dc_2)a4.M).b);
        Object object = new ArrayList<String>();
        object.add(ee.E(mb_2.b));
        object.add(ee.E(mb_2.C));
        if (a5.c.E(a3.j)) {
            object.add(ee.E(mb_2.c));
        }
        JComboBox<String> jComboBox = new JComboBox<String>(object.toArray(new String[0]));
        object = object.iterator();
        while (object.hasNext()) {
            if (!((String)object.next()).equals(string)) continue;
            jComboBox.setSelectedItem(string);
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new ib_1(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(hc_0.E("e!R-F*")), jComboBox));
    }

    private /* synthetic */ void j(sc_1 a2, String a3, df_0<dc_2, ej> a4) {
        la_2 a5;
        int n2;
        String string = ee.E(((dc_2)a4.M).C);
        Object object = ee.E(kc_1.A).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>((E[])object);
        int n3 = ((String[])object).length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (object[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        jComboBox.setEditable(false);
        sc_1 sc_12 = a2;
        sc_12.void_E(jComboBox);
        sc_12.E(((dc_2)a4.M).C != kc_1.A);
        jComboBox.addActionListener(new rb_2(a5, jComboBox, a4, a2, a3));
        object = new JLabel(hc_0.E("q+R-U-N*"));
        sc_1 sc_13 = a2;
        sc_13.void_E((Component)object);
        sc_13.a((JLabel)object, jComboBox);
    }

    @Override
    public void a() {
        la_2 a2;
        la_2 la_22 = a2;
        super.a();
        la_22.c.void_E();
        Object object = la_22.b;
        synchronized (object) {
            Iterator<JDialog> iterator;
            Iterator<JDialog> iterator2 = iterator = a2.M.values().iterator();
            while (iterator2.hasNext()) {
                iterator.next().dispose();
                iterator2 = iterator;
            }
            a2.M.clear();
            return;
        }
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        la_2 a5;
        a2 = new oc_2(a5.ttw_tradefinder_r_0_E().f(), (f_0)a2, a3, a5);
        la_2 la_22 = a5;
        la_22.a(a3.M, la_22.ttw_tradefinder_r_0_E().ttw_tradefinder_ff_1_E(), (j_0)a2);
        return a2;
    }

    @Override
    public void void_E(String a2) {
        la_2 a3;
        la_2 la_22 = a3;
        super.void_E((String)a2);
        Object object = la_22.b;
        synchronized (object) {
            if (a3.M.containsKey(a2)) {
                a2 = a3.M.remove(a2);
                ((Dialog)a2).setVisible(false);
                ((Window)a2).dispose();
            }
            return;
        }
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<dc_2, ej> a4) {
        la_2 a5;
        if (!a5.c.E(a3.j)) {
            return;
        }
        JButton jButton = new JButton(hc_0.E("\u0005B0H2@0Ddw+M1L!\u0001%O \u0001\bH5T-E-U=\u0001\bH2Ddw-D3"));
        a2.void_E(jButton);
        c_0 c_02 = a5.ttw_tradefinder_c_0_E(a3.M);
        if (c_02 == null || !(c_02 instanceof oc_2)) {
            return;
        }
        c_02 = (oc_2)c_02;
        JButton jButton2 = jButton;
        jButton2.addActionListener(new ma_1(a5, a3, (oc_2)c_02, a4));
        a2.j((Component)jButton2, qE.E(af.M));
    }

    public la_2(f_0 a2, r_0 a3) {
        super((f_0)a2, a3);
        la_2 a4;
        a2 = new Pc(ff_0.E("*,\u00170\u000f!\u000f1\u001f\u0012\u000f!\u0001 \u0012\u0001\u000335 \u00121\u000f+\u00016"), Arrays.asList(cd.C, cd.c, cd.D), a2.ttw_tradefinder_qc_1_E());
        a4.c = a2.E(new ab_2(a4));
    }

    private /* synthetic */ void E(sc_1 a2, String a3, df_0<dc_2, ej> a4) {
        la_2 a5;
        int n2;
        String string = ee.E(((dc_2)a4.M).M);
        String[] stringArray = ee.E(ja_0.b).toArray(new String[0]);
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
        jComboBox2.addActionListener(new gd(a5, jComboBox, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(ff_0.E("*$\u001f*\u00131")), jComboBox));
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<dc_2, ej> a4) {
        la_2 a5;
        int n2 = Math.max(6, Math.min(20, ((dc_2)a4.M).c));
        JSlider jSlider = new JSlider(0, 6, 20, n2);
        jSlider.addChangeListener(new jb_1(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(ff_0.E("\u0011\u0003=\u0012e5,\u001c ")), (Component)jSlider));
    }
}

