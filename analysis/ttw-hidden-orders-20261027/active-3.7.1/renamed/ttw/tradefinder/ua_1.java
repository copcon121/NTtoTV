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
import ttw.tradefinder.AB;
import ttw.tradefinder.ab_0;
import ttw.tradefinder.c_0;
import ttw.tradefinder.ca_1;
import ttw.tradefinder.cb_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.ib_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.vb_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.z;
import ttw.tradefinder.za_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.uA
 */
public class ua_1
extends ib_2 {
    private boolean b;
    private boolean c;

    public void A(String a2) {
        ua_1 a3;
        if (a3.c || a3.b) {
            boolean bl = false;
            ua_1 ua_12 = a3;
            df_0 df_02 = a3.ttw_tradefinder_f_0_E().E(ua_12.ttw_tradefinder_r_0_E().f(), a2, a3.ttw_tradefinder_r_0_E().java_lang_String_d(), a3.ttw_tradefinder_r_0_E().ttw_tradefinder_ca_1_E());
            if (ua_12.c && ((ca_1)df_02.M).M != qc_0.M) {
                bl = true;
                ((ca_1)df_02.M).M = qc_0.M;
            }
            if (a3.b && ((ca_1)df_02.M).c != za_1.M) {
                bl = true;
                ((ca_1)df_02.M).c = za_1.M;
            }
            if (bl) {
                a3.ttw_tradefinder_f_0_E().E(a3.ttw_tradefinder_r_0_E().f(), a2, a3.ttw_tradefinder_r_0_E().java_lang_String_d(), df_02);
            }
        }
    }

    public void E(sc_1 a2, String a3, r_0 a4) {
        ua_1 a5;
        r_0 r_02 = a4;
        String string = r_02.A();
        a4 = r_02.java_lang_String_d();
        df_0 df_02 = a5.ttw_tradefinder_f_0_E().E(a5.ttw_tradefinder_r_0_E().f(), a3, (String)a4, a5.ttw_tradefinder_r_0_E().ttw_tradefinder_ca_1_E());
        JLabel jLabel = new JLabel(new ImageIcon(cb_0.E((ca_1)df_02.M)));
        a4 = new AB(a5, a3, (String)a4, df_02, jLabel);
        a2.j((Component)new JLabel(string), (Component)jLabel, a5.E(a3, string, (z)a4));
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        ua_1 a6;
        a6.A(a2.M);
        a5 = new ArrayList();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.java_lang_String_E() + " Settings");
            a5.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.E) {
            a6.E(a3, a2.M, a6.ttw_tradefinder_r_0_E());
        }
        return a5;
    }

    public void E(boolean a2, boolean a3) {
        ua_1 a4;
        ua_1 ua_12 = a4;
        ua_12.c = a2;
        ua_12.b = a3;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        ua_1 a5;
        a5.A(a3.M);
        a2 = new ab_0((f_0)a2, a3, a5.ttw_tradefinder_r_0_E(), a5);
        ua_1 ua_12 = a5;
        ua_12.a(a3.M, ua_12.ttw_tradefinder_r_0_E().ttw_tradefinder_ff_1_E(), (j_0)a2);
        return a2;
    }

    public Component E(String a2, String a3, z a4) {
        ua_1 a5;
        JButton jButton = new JButton(gb_1.E(" %\f5"));
        jButton.addActionListener(new vb_0(a5, jButton, a2, a3, a4));
        return jButton;
    }

    public ua_1(f_0 a2, r_0 a3) {
        ua_1 a4;
        ua_1 ua_12 = a4;
        super(a2, a3);
        ua_12.c = false;
        ua_12.b = false;
    }
}

