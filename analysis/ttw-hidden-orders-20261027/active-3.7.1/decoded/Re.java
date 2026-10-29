/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Ob;
import ttw.tradefinder.df_0;
import ttw.tradefinder.go;
import ttw.tradefinder.hd_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class Re
implements q_0 {
    public final /* synthetic */ lg M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void j() {
        Re a2;
        a2.M.E().j(((Ob)a2.b.M).A.E(a2.c.D, ve_2.w, ve_2.H, ve_2.N, false));
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Re(lg a2, ze_2 a3, df_0 a4) {
        Re a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public String E(boolean a2) {
        Re a3;
        if (a2) {
            return ((Ob)a3.b.M).A.E(a3.c.D, ve_2.w, ve_2.H, ve_2.N, " ");
        }
        return ((Ob)a3.b.M).A.E(a3.c.D, ve_2.w, ve_2.N, " ");
    }

    @Override
    public void E() {
        Re a2;
        a2.M.E().E("TTW-MarketExplorer", a2.c.M, a2.b);
    }

    @Override
    public boolean E() {
        Re a2;
        return a2.M.E().E();
    }

    @Override
    public boolean j() {
        return false;
    }
}

