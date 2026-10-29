/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.function.Consumer;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Rd
implements Consumer<Color> {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ na_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Rd(bb_1 a2, na_0 a3, ze_2 a4, df_0 a5) {
        Rd a6;
        Rd rd = a6;
        rd.M = a2;
        rd.c = a3;
        a6.b = a4;
        a6.C = a5;
    }

    public void E(Color a2) {
        Rd a3;
        if (a3.c.M == a2) {
            return;
        }
        Rd rd = a3;
        rd.c.M = a2;
        Rd rd2 = a3;
        rd.M.ttw_tradefinder_f_0_E().E(a3.M.ttw_tradefinder_r_0_E().f(), rd2.b.M, a3.C);
        rd2.C.E(pf_0.r);
        rd.M.l(a3.b.M);
    }
}

