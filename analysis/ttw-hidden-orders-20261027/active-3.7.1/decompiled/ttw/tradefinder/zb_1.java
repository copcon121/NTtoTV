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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JLabel;
import ttw.tradefinder.c_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gc_0;
import ttw.tradefinder.ha_2;
import ttw.tradefinder.ia_2;
import ttw.tradefinder.j_0;
import ttw.tradefinder.jc_1;
import ttw.tradefinder.jc_2;
import ttw.tradefinder.n;
import ttw.tradefinder.na_1;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.sd_2;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.vb_1;
import ttw.tradefinder.xc_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;
import velox.api.layer1.messages.indicators.WidgetDisplayInfo;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.zB
 */
public class zb_1
extends sd_2 {
    private final r_0 M;

    @Override
    public Map<Double, String> E(r_0 a2, String a3) {
        return Collections.singletonMap(0.0, a2.j());
    }

    public void E(sc_1 a2, String a3, String a4, String a5) {
        zb_1 a6;
        df_0 df_02 = a6.E().E(a6.M.f(), a3, (String)a5, a6.M.E());
        JLabel jLabel = new JLabel(a6.E(a3, (tb_0)df_02.M));
        a5 = new vb_1(a6, a3, df_02, (String)a5, jLabel);
        a2.j((Component)new JLabel(a4), (Component)jLabel, a6.E(a3, a4, (n)a5));
    }

    public zb_1(f_0 a2, r_0 a3) {
        super(a2, a3);
        zb_1 a4;
        a4.M = a3;
    }

    @Override
    public Collection<? extends sc_1> E(ze_2 a2, sc_1 a3, nf_0 a4, sc_1 a5) {
        zb_1 a6;
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

    @Override
    public String E(r_0 a2, Double a3) {
        if (a3 >= 0.0) {
            return a2.g();
        }
        return a2.a();
    }

    @Override
    public IndicatorColorScheme.ColorIntervalResponse E(r_0 a2, double a3, double a4) {
        if (a4 < 0.0) {
            return new IndicatorColorScheme.ColorIntervalResponse(new String[]{a2.a()}, new double[0]);
        }
        if (a3 >= 0.0) {
            return new IndicatorColorScheme.ColorIntervalResponse(new String[]{a2.g()}, new double[0]);
        }
        return new IndicatorColorScheme.ColorIntervalResponse(new String[]{a2.a(), a2.g()}, new double[]{0.0});
    }

    public Component E(String a2, String a3, n a4) {
        zb_1 a5;
        JButton jButton = new JButton(ed_0.E("+\u0004\u0007\u0014"));
        jButton.addActionListener(new jc_1(a5, jButton, a2, a3, a4));
        return jButton;
    }

    @Override
    public c_0 E(f_0 a2, ze_2 a3, xf_2 a4) {
        zb_1 a5;
        f_0 f_02 = a2;
        a2 = new ia_2(f_02, a3, f_02.E(a5.M.f(), a3.M, a5.E(), a5.M.E()), a5.M.E(), a5);
        zb_1 zb_12 = a5;
        zb_12.a(a3.M, zb_12.M.E(), (j_0)a2);
        return a2;
    }

    @Override
    public int E() {
        return 1000;
    }

    @Override
    public List<ha_2> E(r_0 a2) {
        zb_1 a3;
        ArrayList<ha_2> arrayList = new ArrayList<ha_2>();
        arrayList.add(new jc_2(a3, a2));
        arrayList.add(new xc_1(a3, a2));
        arrayList.add(new na_1(a3, a2));
        return arrayList;
    }

    @Override
    public WidgetDisplayInfo E() {
        return new WidgetDisplayInfo(WidgetDisplayInfo.Type.SYMMETRIC, 0.0);
    }

    private /* synthetic */ ImageIcon E(String a2, tb_0 a3) {
        zb_1 a4;
        zb_1 zb_12 = a4;
        zb_1 zb_13 = a4;
        return new ImageIcon(gc_0.j(80, 20, zb_12.getColor(a2, zb_12.M.g()), zb_13.getColor(a2, zb_13.M.a()), a3));
    }
}

