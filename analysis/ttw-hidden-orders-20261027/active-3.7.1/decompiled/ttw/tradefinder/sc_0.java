/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.List;
import java.util.function.BiConsumer;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.sc
 */
public class sc_0
implements BiConsumer<Integer, na_0> {
    public final /* synthetic */ df_0 D;
    public final /* synthetic */ sc_1 A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ bb_1 M;
    public final /* synthetic */ List b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ sc_0(bb_1 a2, List a3, ze_2 a4, sc_1 a5, sc_1 a6, df_0 a7) {
        sc_0 a8;
        sc_0 sc_02 = a8;
        sc_0 sc_03 = a8;
        sc_03.M = a2;
        sc_03.b = a3;
        sc_02.c = a4;
        sc_02.C = a5;
        a8.A = a6;
        a8.D = a7;
    }

    public void E(Integer a2, na_0 a3) {
        sc_0 a4;
        sc_0 sc_02 = a4;
        sc_0 sc_03 = a4;
        sc_02.b.add(sc_02.M.E(a4.c, a2, a3, sc_03.C, sc_03.A, a4.D));
    }
}

