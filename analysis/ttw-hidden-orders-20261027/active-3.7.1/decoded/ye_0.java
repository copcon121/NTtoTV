/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Oc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.lg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ua;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.YE
 */
public class ye_0
implements q_0 {
    public final /* synthetic */ lg M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public boolean E() {
        ye_0 a2;
        return a2.M.E().E();
    }

    @Override
    public void E() {
        ye_0 a2;
        a2.M.E().E("TTW-MarketExplorer", a2.b.M, a2.c);
    }

    @Override
    public void j() {
        ye_0 a2;
        a2.M.E().j(((ua)a2.c.M).H.E(a2.b.D, ve_2.D, ve_2.n, ve_2.Z, false));
    }

    @Override
    public boolean j() {
        return false;
    }

    @Override
    public String E(boolean a2) {
        ye_0 a3;
        if (a2) {
            return ((ua)a3.c.M).H.E(a3.b.D, ve_2.D, ve_2.n, ve_2.Z, " ");
        }
        return ((ua)a3.c.M).H.E(a3.b.D, ve_2.D, ve_2.Z, " ");
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ye_0(lg a2, ze_2 a3, df_0 a4) {
        ye_0 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }
}

