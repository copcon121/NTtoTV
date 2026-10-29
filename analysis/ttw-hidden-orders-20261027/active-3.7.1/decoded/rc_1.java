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
import ttw.tradefinder.af_2;
import ttw.tradefinder.c_0;
import ttw.tradefinder.da_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.j_0;
import ttw.tradefinder.lb_0;
import ttw.tradefinder.ma_2;
import ttw.tradefinder.mc_0;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.s;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ta_2;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Rc
 */
public class rc_1
extends ma_2 {
    private final r_0 D;
    private final boolean c;

    public void E(sc_1 a2, String a32, String a4) {
        rc_1 a5;
        Object object = a5.E().E(a5.D.f(), a32, a4, a5.D.E());
        JLabel jLabel = new JLabel(new ImageIcon(hc_0.E((da_1)((df_0)object).M, a5.D.E().E())));
        object = new ta_2(a5, (df_0)object, a32, a4, jLabel);
        int a32 = a2.j((Component)new JLabel(a4), (Component)jLabel, a5.E(a32, a4, (s)object));
        if (a5.c) {
            a2.E(a32);
        }
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        rc_1 a6;
        a5 = new ArrayList();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            a5.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.E) {
            a6.E(a3, a2.M, a6.E());
        }
        return a5;
    }

    public rc_1(f_0 a2, r_0 a3, boolean a4) {
        rc_1 a5;
        rc_1 rc_12 = a5;
        r_0 r_02 = a3;
        super(a2, r_02);
        rc_12.D = r_02;
        rc_12.c = a4;
    }

    @Override
    public int E() {
        return 1000;
    }

    public Component E(String a2, String a3, s a4) {
        rc_1 a5;
        JButton jButton = new JButton("Edit");
        jButton.addActionListener(new lb_0(a5, jButton, a2, a3, a4));
        return jButton;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        rc_1 a5;
        f_0 f_02 = a2;
        a2 = new mc_0(f_02, a3, f_02.E(a5.D.f(), a3.M, a5.E(), a5.D.E()), a5.D.E(), a5);
        rc_1 rc_12 = a5;
        rc_12.a(a3.M, rc_12.D.E(), (j_0)a2);
        return a2;
    }
}

