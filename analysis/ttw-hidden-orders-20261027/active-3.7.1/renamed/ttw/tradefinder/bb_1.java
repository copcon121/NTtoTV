/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.ColorsConfigItem
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dialog;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.function.Consumer;
import javax.swing.AbstractButton;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import ttw.tradefinder.K;
import ttw.tradefinder.Pc;
import ttw.tradefinder.Rd;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.dc_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.hK;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.kd_0;
import ttw.tradefinder.ld_1;
import ttw.tradefinder.lf_1;
import ttw.tradefinder.md_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.na_2;
import ttw.tradefinder.ne_1;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.oa_2;
import ttw.tradefinder.qE;
import ttw.tradefinder.q_0;
import ttw.tradefinder.qa_1;
import ttw.tradefinder.qc_2;
import ttw.tradefinder.r_0;
import ttw.tradefinder.rb_1;
import ttw.tradefinder.sc_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tc_1;
import ttw.tradefinder.uc_1;
import ttw.tradefinder.vc_0;
import ttw.tradefinder.xa_2;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ya_2;
import ttw.tradefinder.yf_2;
import ttw.tradefinder.ze_2;
import velox.gui.colors.ColorsConfigItem;

/*
 * Renamed from ttw.tradefinder.BB
 */
public class bb_1
extends ib_2 {
    private Object C;
    private static int M = 40;
    private Map<String, md_0> b = new HashMap<String, md_0>();
    private final K c;

    private /* synthetic */ void H(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        bb_1 a6;
        na_0 na_02 = a5;
        a3 = new ColorsConfigItem(na_02.M, na_02.M, (Consumer)new Rd(a6, a5, a3, a4));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.E(new JLabel(gb_1.E("\u0000\t$\u00175E\"\n-\n3")), (Component)((Object)a3)));
    }

    private /* synthetic */ void A(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        int n2;
        bb_1 a6;
        if (!a6.ttw_tradefinder_f_0_E().ttw_tradefinder_ed_2_E().E(a3.j)) {
            return;
        }
        String string = ee.E(a5.D);
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
        jComboBox2.addActionListener(new rb_1(a6, jComboBox, a5, a3, a4));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(ae_1.E("WDjE$uaMaFv@i\u0001JNpHbHg@pHkO")), jComboBox));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        bb_1 a6;
        if (!a6.ttw_tradefinder_f_0_E().boolean_j()) {
            return Collections.emptyList();
        }
        df_0<oa_0, hK> df_02 = a6.ttw_tradefinder_f_0_E().E(a6.ttw_tradefinder_r_0_E().f(), a2.M, new oa_0());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a4 == nf_0.O || a4 == nf_0.z) {
            ((oa_0)df_02.M).E(new sc_0(a6, arrayList, a2, a3, a5, df_02));
            sc_1 sc_12 = a3 = new sc_1(a2.M, a6.java_lang_String_E() + " - Common", 999, a3.boolean_a(), a3.ttw_tradefinder_xf_1_E(), a3.ttw_tradefinder_af_0_E(), a6.ttw_tradefinder_f_0_E());
            ze_2 ze_22 = a2;
            a6.E(a3, ze_22, df_02, a5);
            a6.E(sc_12, ze_22, df_02);
            arrayList.add(sc_12);
        }
        return arrayList;
    }

    public bb_1(f_0 a2, r_0 a3) {
        super((f_0)a2, a3);
        bb_1 a4;
        a4.C = new Object();
        a2 = new Pc(ae_1.E("AYpDjEaEWNqO`bkObHcTv@pHkO"), Arrays.asList(cd.C, cd.c, cd.D), a2.ttw_tradefinder_qc_1_E());
        a4.c = a2.E(null);
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4) {
        JButton jButton;
        bb_1 a5;
        JButton jButton2 = new JButton(ae_1.E("KQaO$qvHgD$`hDvUw\u0001UTmBo\u0001WDpUmOcR"));
        if (((oa_0)((df_0)a4).M).int_E() == 0) {
            JButton jButton3 = jButton2;
            a2.void_E(jButton3);
            jButton3.setEnabled(false);
            a4 = a5.C;
            synchronized (a4) {
                if (a5.b.containsKey(a3.M)) {
                    a5.b.get(a3.M).setVisible(false);
                }
                // MONITOREXIT @DISABLED, blocks:[0, 1, 5] lbl11 : MonitorExitStatement: MONITOREXIT : a
                jButton = jButton2;
            }
        } else {
            jButton = jButton2;
        }
        jButton.addActionListener(new uc_1(a5, a3));
        a2.f(jButton2);
    }

    private /* synthetic */ void d(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        int n2;
        bb_1 a6;
        if (!a6.ttw_tradefinder_f_0_E().ttw_tradefinder_ed_2_E().E(a3.j)) {
            return;
        }
        String string = ee.E(a5.c);
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
        jComboBox2.addActionListener(new tc_1(a6, jComboBox, a5, a3, a4));
        sc_1 sc_12 = a2;
        sc_12.void_E(sc_12.a(new JLabel(gb_1.E("\u0003\n.\u000e,\u00041E\u0000\t$\u00175E\f\u00002\u0016 \u0002$")), jComboBox));
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        bb_1 a6;
        if (!a6.ttw_tradefinder_f_0_E().boolean_j()) {
            return;
        }
        a4 = new qc_2(a6, a3, (df_0)a4, a5);
        if (!a6.c.E(a3.j)) {
            yf_2.E(a2, a5.A, (q_0)a4);
            return;
        }
        yf_2.E(a3.M, a2, a5.A, (q_0)a4);
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        bb_1 a6;
        String string = a3.E();
        double d2 = a3.c;
        double d3 = d2 * 1.0E9;
        double d4 = a3.c;
        double d5 = Math.max(d2, Math.min(d3, (double)a5.H * a3.c));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d3, d4);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        JSpinner.NumberEditor numberEditor = new JSpinner.NumberEditor((JSpinner)serializable, string);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor(numberEditor);
        ((JSpinner)serializable2).addChangeListener(new xa_2(a6, (JSpinner)serializable, (ze_2)a3, a5, a4));
        a3 = qE.E(d2, d3, d4, string);
        a2.j(new JLabel(gb_1.E("\u0011\u0017(\u0006$")), (Component)serializable, qE.E(lf_1.c, a3));
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        bb_1 a5;
        bb_1 bb_12 = a5;
        return new oa_2(a5.ttw_tradefinder_r_0_E().f(), a2, a3, bb_12, bb_12);
    }

    private /* synthetic */ sc_1 E(ze_2 a2, int a3, na_0 a4, sc_1 a5, sc_1 a6, df_0<oa_0, hK> a7) {
        bb_1 a8;
        a5 = new sc_1(a2.M, a8.java_lang_String_E() + a3, a8.java_lang_String_E() + " - " + a4.b, a3 + 2, a5.boolean_a(), a5.ttw_tradefinder_xf_1_E(), a5.ttw_tradefinder_af_0_E(), a8.ttw_tradefinder_f_0_E());
        bb_1 bb_12 = a8;
        sc_1 sc_12 = a5;
        ze_2 ze_22 = a2;
        a8.E(a5, ze_22, a7, a4, a3, a6);
        a8.E(sc_12, ze_22, a7, a4);
        bb_12.j(sc_12, a2, a7, a4);
        bb_12.H(a5, a2, a7, a4);
        if (bb_12.ttw_tradefinder_f_0_E().boolean_j()) {
            bb_1 bb_13 = a8;
            sc_1 sc_13 = a5;
            a8.a(sc_13, a2, a7, a4);
            bb_13.A(sc_13, a2, a7, a4);
            bb_13.d(a5, a2, a7, a4);
        }
        return a5;
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, sc_1 a5) {
        bb_1 a6;
        JButton jButton = new JButton(ae_1.E("``E$OaV"));
        jButton.addActionListener(new dc_1(a6, a4, a3, a2, jButton, (sc_1)a5));
        if (((oa_0)a4.M).int_E() >= M) {
            JButton jButton2 = jButton;
            a2.void_E(jButton2);
            jButton2.setEnabled(false);
        }
        a5 = new JButton(gb_1.E("7$\b.\u0013$E \t-"));
        if (((oa_0)a4.M).int_E() == 0) {
            JComponent jComponent = a5;
            a2.void_E(jComponent);
            ((AbstractButton)jComponent).setEnabled(false);
        }
        ((AbstractButton)a5).addActionListener(new ld_1(a6, a4, a3));
        a2.j((Component)jButton, (Component)a5);
    }

    private /* synthetic */ void l(String a2) {
        bb_1 a3;
        SwingUtilities.invokeLater(() -> {
            bb_1 a3;
            Object object = a3.C;
            synchronized (object) {
                if (a3.b.containsKey(a2)) {
                    a3.b.get(a2).j();
                }
                return;
            }
        });
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5, int a6, sc_1 a7) {
        sc_1 sc_12;
        bb_1 a8;
        JCheckBox jCheckBox = new JCheckBox(ae_1.E("AOeChD"));
        jCheckBox.setSelected(a5.C);
        jCheckBox.addItemListener(new kd_0(a8, jCheckBox, a5, a3, a4));
        JButton jButton = new JButton(gb_1.E("7$\b.\u0013$"));
        jButton.addActionListener(new qa_1(a8, a4, a6, a3, a7, a2));
        JButton jButton2 = new JButton(ae_1.E("bhNjD"));
        if (((oa_0)a4.M).int_E() >= M) {
            sc_1 sc_13 = a2;
            sc_12 = sc_13;
            sc_13.void_E(jButton2);
            jButton2.setEnabled(false);
        } else {
            jButton2.addActionListener(new ya_2(a8, a5, a4, a6, a3, a2, jButton2, a7));
            sc_12 = a2;
        }
        sc_12.j((Component)jCheckBox, (Component)jButton2, jButton);
    }

    @Override
    public void void_E(String a2) {
        bb_1 a3;
        bb_1 bb_12 = a3;
        super.void_E((String)a2);
        Object object = bb_12.C;
        synchronized (object) {
            if (a3.b.containsKey(a2)) {
                a2 = a3.b.remove(a2);
                ((Dialog)a2).setVisible(false);
                ((md_0)a2).E();
            }
            return;
        }
    }

    @Override
    public void a() {
        bb_1 a2;
        bb_1 bb_12 = a2;
        super.a();
        bb_12.c.void_E();
        Object object = bb_12.C;
        synchronized (object) {
            Iterator<md_0> iterator;
            Iterator<md_0> iterator2 = iterator = a2.b.values().iterator();
            while (iterator2.hasNext()) {
                iterator.next().E();
                iterator2 = iterator;
            }
            a2.b.clear();
            return;
        }
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<oa_0, hK> a4, na_0 a5) {
        bb_1 a6;
        JTextField jTextField = new JTextField(10);
        jTextField.putClientProperty(gb_1.E("\u000b1$\u001d5#(\u0000-\u0001o\u00064\u0011\u0002\n1\u001c\u0000\t-\n6\u0000%"), Boolean.TRUE);
        sc_1 sc_12 = a2;
        JTextField jTextField2 = jTextField;
        JTextField jTextField3 = jTextField;
        ne_1.E(jTextField);
        jTextField3.setHorizontalAlignment(0);
        jTextField2.setText(a5.b);
        jTextField3.setFont(jTextField3.getFont().deriveFont(13.0f));
        jTextField2.addFocusListener(new na_2(a6, jTextField, a5, a3, a4, a2));
        jTextField2.addKeyListener(new vc_0(a6, jTextField, a5, a3, a4, a2));
        sc_12.void_E(sc_12.a(new JLabel(ae_1.E("J@iD")), (Component)jTextField));
    }

    public void A(String a2) {
        bb_1 a3;
        bb_1 bb_12 = a3;
        bb_12.l(a2);
        bb_12.ttw_tradefinder_f_0_E().void_E();
    }
}

