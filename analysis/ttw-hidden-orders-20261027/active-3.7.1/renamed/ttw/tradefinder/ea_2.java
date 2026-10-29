/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.K;
import ttw.tradefinder.LC;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.wb_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.eA
 */
public class ea_2
implements g_0 {
    public final /* synthetic */ f_0 C;
    public final /* synthetic */ wb_1 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ String c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ea_2(wb_1 a2, ze_2 a3, f_0 a4, String a5) {
        ea_2 a6;
        ea_2 ea_22 = a6;
        ea_22.M = a2;
        ea_22.b = a3;
        a6.C = a4;
        a6.c = a5;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        ea_2 a5;
        if (a4 && !a2.E(a5.b.j) && ((LC)a5.M.C.M).M) {
            ((LC)a5.M.C.M).M = false;
            ea_2 ea_22 = a5;
            ea_2 ea_23 = a5;
            ea_22.C.E(ea_22.c, ea_23.b.M, a5.M.C);
            ea_23.M.a(((LC)a5.M.C.M).M);
        }
    }
}

