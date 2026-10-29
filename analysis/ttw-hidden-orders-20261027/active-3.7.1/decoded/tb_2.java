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
import ttw.tradefinder.Q;
import ttw.tradefinder.Zb;
import ttw.tradefinder.c_0;
import ttw.tradefinder.dc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fC;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gb_0;
import ttw.tradefinder.j_0;
import ttw.tradefinder.ma_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sb_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.se_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.TB
 */
public class tb_2
extends ma_2 {
    private final boolean c;
    private final r_0 D;

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        tb_2 a6;
        a5 = new ArrayList();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            a5.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.E) {
            a6.E(a3, a2.M, a6.D.A(), a6.E());
        }
        return a5;
    }

    public Component E(String a2, String a3, Q a4) {
        tb_2 a5;
        JButton jButton = new JButton("Edit");
        jButton.addActionListener(new Zb(a5, jButton, a2, a3, a4));
        return jButton;
    }

    @Override
    public int E() {
        return 1000;
    }

    public tb_2(f_0 a2, r_0 a3, boolean a4) {
        tb_2 a5;
        tb_2 tb_22 = a5;
        r_0 r_02 = a3;
        super(a2, r_02);
        tb_22.D = r_02;
        tb_22.c = a4;
    }

    public void E(sc_1 a2, String a32, String a4, String a5) {
        tb_2 a6;
        df_0 df_02 = a6.E().E(a6.D.f(), a32, (String)a5, a6.D.E());
        JLabel jLabel = new JLabel(new ImageIcon(dc.E((fC)df_02.M)));
        a5 = new sb_2(a6, df_02, a32, (String)a5, jLabel);
        int a32 = a2.j((Component)new JLabel(a4), (Component)jLabel, a6.E(a32, a4, (Q)a5));
        if (a6.c) {
            a2.E(a32);
        }
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        tb_2 a5;
        f_0 f_02 = a2;
        a2 = new gb_0(f_02, a3, f_02.E(a5.D.f(), a3.M, a5.D.d(), a5.D.E()), a5.D.E(), a5);
        tb_2 tb_22 = a5;
        tb_22.a(a3.M, tb_22.D.E(), (j_0)a2);
        return a2;
    }
}

