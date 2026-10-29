/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.dE;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_2;
import ttw.tradefinder.me_1;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.za_0;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.BD
 */
public class bd_1
implements q_0 {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ dE c;

    @Override
    public void E() {
        bd_1 a2;
        a2.c.E().E("TTW-HiddenOrders", a2.M.M, a2.b);
    }

    @Override
    public boolean E() {
        bd_1 a2;
        return a2.c.E().E();
    }

    @Override
    public void j() {
        bd_1 a2;
        a2.c.E().j(((za_0)a2.b.M).D.E(a2.M.D, ve_2.E, ve_2.M, ve_2.u, false));
    }

    @Override
    public boolean j() {
        return false;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ bd_1(dE a2, ze_2 a3, df_0 a4) {
        bd_1 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }

    @Override
    public String E(boolean a2) {
        bd_1 a3;
        if (a2) {
            return ((za_0)a3.b.M).D.E(a3.M.D, ve_2.E, ve_2.M, ve_2.u, " ");
        }
        return ((za_0)a3.b.M).D.E(a3.M.D, ve_2.E, ve_2.u, " ");
    }
}

