/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.if_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.pa_0;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.rD
 */
public class rd_1
implements q_0 {
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public boolean E() {
        rd_1 a2;
        return a2.b.E().E();
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ rd_1(lg a2, ze_2 a3, df_0 a4) {
        rd_1 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }

    @Override
    public void j() {
        rd_1 a2;
        a2.b.E().j(((pa_0)a2.M.M).b.E(a2.c.D, ve_2.U, ve_2.T, ve_2.K, false));
    }

    @Override
    public String E(boolean a2) {
        rd_1 a3;
        if (a2) {
            return ((pa_0)a3.M.M).b.E(a3.c.D, ve_2.U, ve_2.T, ve_2.K, " ");
        }
        return ((pa_0)a3.M.M).b.E(a3.c.D, ve_2.U, ve_2.K, " ");
    }

    @Override
    public void E() {
        rd_1 a2;
        a2.b.E().E("TTW-MarketExplorer", a2.c.M, a2.M);
    }

    @Override
    public boolean j() {
        return false;
    }
}

