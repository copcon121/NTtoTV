/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.util.ArrayList;
import java.util.Collection;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.LC;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cb_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.go;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.im;
import ttw.tradefinder.j_0;
import ttw.tradefinder.nb_1;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.pd_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wb_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.OC
 */
public class oc_1
extends ib_2 {
    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        oc_1 a6;
        a5 = a6.E().E(a6.E().f(), a2.M, new LC());
        ArrayList<sc_1> arrayList = new ArrayList<sc_1>();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            arrayList.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.C) {
            a6.E(a3, a2, (df_0<LC, im>)a5);
        }
        if (a4 == nf_0.O || a4 == nf_0.Ga) {
            sc_1 sc_12 = a3;
            a6.j(sc_12, a2, (df_0<LC, im>)a5);
            a6.a(sc_12, a2, (df_0<LC, im>)a5);
        }
        return arrayList;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        oc_1 a5;
        a2 = new wb_1(a5.E().f(), (f_0)a2, a3, a5);
        oc_1 oc_12 = a5;
        oc_12.a(a3.M, oc_12.E().E(), (j_0)a2);
        return a2;
    }

    private /* synthetic */ void a(sc_1 a2, ze_2 a3, df_0<LC, im> a4) {
        oc_1 a5;
        int n2 = Math.max(0, Math.min(120, ((LC)a4.M).c));
        JSlider jSlider = new JSlider(0, 0, 120, n2);
        jSlider.addChangeListener(new nb_1(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(go.E("\u0018z1v")), (Component)jSlider));
    }

    private /* synthetic */ void j(sc_1 a2, ze_2 a3, df_0<LC, im> a4) {
        oc_1 a5;
        int n2 = Math.max(0, Math.min(100, ((LC)a4.M).C));
        JSlider jSlider = new JSlider(0, 0, 100, n2);
        jSlider.addChangeListener(new cb_2(a5, a4, a3));
        sc_1 sc_12 = a2;
        sc_12.E(sc_12.a(new JLabel(hc_0.E("q+R-U-N*")), (Component)jSlider));
    }

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<LC, im> a4) {
        oc_1 a5;
        JCheckBox jCheckBox = new JCheckBox(go.E("\u000e}*q'v"));
        jCheckBox.setSelected(((LC)a4.M).M);
        sc_1 sc_12 = a2;
        sc_12.E(jCheckBox);
        sc_12.E(((LC)a4.M).M);
        JCheckBox jCheckBox2 = jCheckBox;
        jCheckBox2.addItemListener(new pd_0(a5, jCheckBox, a4, a2, a3));
        a2.l(jCheckBox2);
    }

    public oc_1(f_0 a2, r_0 a3) {
        super(a2, a3);
        oc_1 a4;
    }
}

