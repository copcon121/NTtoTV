/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme$ColorIntervalResponse
 *  velox.api.layer1.messages.indicators.WidgetDisplayInfo
 *  velox.api.layer1.messages.indicators.WidgetDisplayInfo$Type
 */
package ttw.tradefinder;

import java.awt.Component;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JLabel;
import ttw.tradefinder.c_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gc_0;
import ttw.tradefinder.ha_2;
import ttw.tradefinder.hb_2;
import ttw.tradefinder.ia_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.mc_1;
import ttw.tradefinder.n;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sd_2;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.zb_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;
import velox.api.layer1.messages.indicators.WidgetDisplayInfo;

/*
 * Renamed from ttw.tradefinder.EA
 */
public class ea_1
extends sd_2 {
    private final r_0 M;

    @Override
    public String E(r_0 a2, Double a3) {
        ea_1 a4;
        return a4.E();
    }

    @Override
    public IndicatorColorScheme.ColorIntervalResponse E(r_0 a2, double a3, double a4) {
        ea_1 a5;
        return new IndicatorColorScheme.ColorIntervalResponse(new String[]{a5.E()}, new double[0]);
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        ea_1 a6;
        a5 = new ArrayList();
        if (a3 == null) {
            a3 = new sc_1(a2.M, a6.E() + " Settings");
            a5.add(a3);
        }
        if (a4 == nf_0.O || a4 == nf_0.r) {
            a6.E(a3, a2.M, a6.M.A(), a6.E());
        }
        return a5;
    }

    private /* synthetic */ ImageIcon E(String a2, tb_0 a3) {
        ea_1 a4;
        ea_1 ea_12 = a4;
        return new ImageIcon(gc_0.E(80, 20, ea_12.getColor(a2, ea_12.M.d()), a3));
    }

    @Override
    public List<ha_2> E(r_0 a2) {
        ea_1 a3;
        ArrayList<ha_2> arrayList = new ArrayList<ha_2>();
        arrayList.add(new hb_2(a3, a2));
        return arrayList;
    }

    public Component E(String a2, String a3, n a4) {
        ea_1 a5;
        JButton jButton = new JButton(xf_0.E("`xLh"));
        jButton.addActionListener(new mc_1(a5, jButton, a2, a3, a4));
        return jButton;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        ea_1 a5;
        f_0 f_02 = a2;
        a2 = new ia_2(f_02, a3, f_02.E(a5.M.f(), a3.M, a5.E(), a5.M.E()), a5.M.E(), a5);
        ea_1 ea_12 = a5;
        ea_12.a(a3.M, ea_12.M.E(), (j_0)a2);
        return a2;
    }

    public ea_1(f_0 a2, r_0 a3) {
        super(a2, a3);
        ea_1 a4;
        a4.M = a3;
    }

    @Override
    public WidgetDisplayInfo E() {
        return new WidgetDisplayInfo(WidgetDisplayInfo.Type.SYMMETRIC, 0.0);
    }

    public void E(sc_1 a2, String a3, String a4, String a5) {
        ea_1 a6;
        df_0 df_02 = a6.E().E(a6.M.f(), a3, (String)a5, a6.M.E());
        JLabel jLabel = new JLabel(a6.E(a3, (tb_0)df_02.M));
        a5 = new zb_0(a6, a3, df_02, (String)a5, jLabel);
        a2.j((Component)new JLabel(a4), (Component)jLabel, a6.E(a3, a4, (n)a5));
    }
}

