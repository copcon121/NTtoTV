/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.K;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.jb_2;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Nb
 */
public class nb_2
implements g_0 {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ jb_2 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ f_0 c;

    @Override
    public /* synthetic */ void E(K a2, boolean a3, boolean a4) {
        nb_2 a5;
        if (!a4) {
            a5.M.F = false;
            return;
        }
        a5.M.F = a2.E(a5.C.j);
        if (!a2.E(a5.C.j)) {
            if (((za_0)a5.M.G.M).C != ae_2.c) {
                ((za_0)a5.M.G.M).C = ae_2.c;
                nb_2 nb_22 = a5;
                nb_22.c.E(nb_22.b, a5.C.M, a5.M.G);
            }
            if (((za_0)a5.M.G.M).A != ae_2.c) {
                ((za_0)a5.M.G.M).A = ae_2.c;
                nb_2 nb_23 = a5;
                nb_23.c.E(nb_23.b, a5.C.M, a5.M.G);
                return;
            }
        } else if (a5.C.j == dd_1.C || a5.C.j == dd_1.D || a5.C.j == dd_1.A) {
            if (((za_0)a5.M.G.M).C != ae_2.M) {
                ((za_0)a5.M.G.M).C = ae_2.M;
                nb_2 nb_24 = a5;
                nb_24.c.E(nb_24.b, a5.C.M, a5.M.G);
            }
            if (((za_0)a5.M.G.M).A != ae_2.M) {
                ((za_0)a5.M.G.M).A = ae_2.M;
                nb_2 nb_25 = a5;
                nb_25.c.E(nb_25.b, a5.C.M, a5.M.G);
            }
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nb_2(jb_2 a2, ze_2 a3, f_0 a4, String a5) {
        nb_2 a6;
        nb_2 nb_22 = a6;
        nb_22.M = a2;
        nb_22.C = a3;
        a6.c = a4;
        a6.b = a5;
    }
}

