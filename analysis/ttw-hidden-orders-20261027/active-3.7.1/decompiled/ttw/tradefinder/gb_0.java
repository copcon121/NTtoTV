/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable$Marker
 */
package ttw.tradefinder;

import ttw.tradefinder.JB;
import ttw.tradefinder.Jd;
import ttw.tradefinder.a_0;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.er;
import ttw.tradefinder.fC;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.sc_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;

/*
 * Renamed from ttw.tradefinder.gb
 */
public class gb_0
extends sc_2 {
    private final df_0<fC, er> b;
    private final ff_1 c;

    @Override
    public void E(ff_1 a2, int a3, Jd a4, long a5, long a6) {
        gb_0 a7;
        if (a2 != a7.c) {
            return;
        }
        gb_0 gb_02 = a7;
        gb_02.E(new JB(a4, a3), a5);
        if (gb_02.D.j() && a5 + cd_2.h < a6) {
            a7.E(false);
        }
    }

    public gb_0(f_0 a2, ze_2 a3, df_0<fC, er> a4, ff_1 a5, s_0 a6) {
        gb_0 a7;
        gb_0 gb_02 = a7;
        super(a2, a3, a6);
        gb_02.c = a5;
        gb_02.b = a4;
    }

    @Override
    public OnlineCalculatable.Marker E(a_0 a2) {
        gb_0 a3;
        return a2.E((fC)a3.b.M);
    }

    @Override
    public void E(ff_1 a2, int a3, Jd a4, long a5) {
        gb_0 a6;
        if (a2 != a6.c) {
            return;
        }
        a6.E(new JB(a4, a3), a5);
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        gb_0 a5;
        if (a2 != a5.c) {
            return;
        }
        if (a3 == oe_1.M) {
            a5.a(a4);
            return;
        }
        if (a3 == oe_1.b && a4) {
            a5.a();
        }
    }

    @Override
    public void E(ff_1 a2) {
        gb_0 a3;
        if (a2 != a3.c) {
            return;
        }
        a3.E(true);
    }
}

