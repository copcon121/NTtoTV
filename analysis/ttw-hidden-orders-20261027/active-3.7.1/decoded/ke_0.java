/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ac_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Ke
 */
public class ke_0
implements q_0 {
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ lg b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void E() {
        ke_0 a2;
        a2.b.E().E("TTW-MarketExplorer", a2.c.M, a2.M);
    }

    @Override
    public String E(boolean a2) {
        ke_0 a3;
        if (a2) {
            return ((xa_0)a3.M.M).A.j(a3.c.D, ve_2.i, ve_2.e, ve_2.L);
        }
        return ((xa_0)a3.M.M).A.E(a3.c.D, ve_2.i, ve_2.L, " ");
    }

    @Override
    public boolean E() {
        ke_0 a2;
        return a2.b.E().E();
    }

    @Override
    public void j() {
        ke_0 a2;
        a2.b.E().j(((xa_0)a2.M.M).A.E(a2.c.D, ve_2.i, ve_2.e, ve_2.L, false));
    }

    @Override
    public boolean j() {
        return true;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ke_0(lg a2, ze_2 a3, df_0 a4) {
        ke_0 a5;
        a5.b = a2;
        a5.c = a3;
        a5.M = a4;
    }
}

