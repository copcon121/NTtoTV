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
 * Renamed from ttw.tradefinder.xb
 */
public class xb_0
implements Consumer<Color> {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ ob_1 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ xb_0(ob_1 a2, df_0 a3, ze_2 a4) {
        xb_0 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    public void E(Color a2) {
        xb_0 a3;
        ((ua_0)a3.c.M).b = a2;
        xb_0 xb_02 = a3;
        a3.b.E().E(a3.b.E().f(), xb_02.M.M, a3.c);
        xb_02.c.E(pf_0.B);
    }
}

