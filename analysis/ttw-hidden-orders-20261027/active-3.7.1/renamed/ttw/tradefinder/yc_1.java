/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.util.ArrayList;
import java.util.Collection;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JLabel;
import ttw.tradefinder.P;
import ttw.tradefinder.c_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.hb_1;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.jd_0;
import ttw.tradefinder.nd;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Yc
 */
public class yc_1
extends ib_2 {
    public Component E(String a2, String a3, P a4) {
        yc_1 a5;
        JButton jButton = new JButton(cc_0.E("g0K "));
        jButton.addActionListener(new nd(a5, jButton, a2, a3, a4));
        return jButton;
    }

    public yc_1(f_0 a2, r_0 a3) {
        super(a2, a3);
        yc_1 a4;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        yc_1 a5;
        f_0 f_02 = a2;
        a2 = new hb_1(f_02, a3, f_02.E(a5.ttw_tradefinder_r_0_E().f(), a3.M, a5.java_lang_String_E(), a5.ttw_tradefinder_r_0_E().ttw_tradefinder_ib_0_E()), a5.ttw_tradefinder_r_0_E().ttw_tradefinder_ff_1_E(), a5);
        yc_1 yc_12 = a5;
        yc_12.a(a3.M, yc_12.ttw_tradefinder_r_0_E().ttw_tradefinder_ff_1_E(), (j_0)a2);
        return a2;
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        yc_1 a6;
        a5 = new ArrayList();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.java_lang_String_E() + " Settings");
            a5.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.E) {
            a6.E(a3, a2.M, a6.ttw_tradefinder_r_0_E().A(), a6.java_lang_String_E());
        }
        return a5;
    }

    public void E(sc_1 a2, String a3, String a4, String a5) {
        yc_1 a6;
        df_0 df_02 = a6.ttw_tradefinder_f_0_E().E(a6.ttw_tradefinder_r_0_E().f(), a3, (String)a5, a6.ttw_tradefinder_r_0_E().ttw_tradefinder_ib_0_E());
        JLabel jLabel = new JLabel(new ImageIcon(gc_1.E((ib_0)df_02.M, 10)));
        a5 = new jd_0(a6, df_02, a3, (String)a5, jLabel);
        a2.j((Component)new JLabel(a4), (Component)jLabel, a6.E(a3, a4, (P)a5));
    }
}

