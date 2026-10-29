/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.function.Consumer;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.zb
 */
public class zb_2
implements Consumer<Color> {
    public final /* synthetic */ ob_1 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    public void E(Color a2) {
        zb_2 a3;
        ((ua_0)a3.c.M).c = a2;
        zb_2 zb_22 = a3;
        a3.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), zb_22.b.M, a3.c);
        zb_22.c.E(pf_0.B);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ zb_2(ob_1 a2, df_0 a3, ze_2 a4) {
        zb_2 a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }
}

