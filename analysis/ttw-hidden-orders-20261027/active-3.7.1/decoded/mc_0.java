/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable$Marker
 */
package ttw.tradefinder;

import ttw.tradefinder.a_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.da_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.eq;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pb_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.sc_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;

/*
 * Renamed from ttw.tradefinder.Mc
 */
public class mc_0
extends sc_2 {
    private final ff_1 b;
    private final df_0<da_1, eq> c;

    public mc_0(f_0 a2, ze_2 a3, df_0<da_1, eq> a4, ff_1 a5, s_0 a6) {
        mc_0 a7;
        mc_0 mc_02 = a7;
        super(a2, a3, a6);
        mc_02.b = a5;
        mc_02.c = a4;
    }

    @Override
    public OnlineCalculatable.Marker E(a_0 a2) {
        mc_0 a3;
        return a2.E((da_1)a3.c.M);
    }

    @Override
    public void E(ff_1 a2, int a3, cc_0 a4, long a5, long a6) {
        mc_0 a7;
        if (a2 != a7.b) {
            return;
        }
        mc_0 mc_02 = a7;
        mc_02.E(new pb_0(a4, a3), a5);
        if (mc_02.D.j() && a5 + cd_2.h < a6) {
            a7.E(false);
        }
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        mc_0 a5;
        if (a2 != a5.b) {
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
        mc_0 a3;
        if (a2 != a3.b) {
            return;
        }
        a3.E(true);
    }
}

