/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.xf_0;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.ND
 */
public class nd_1
implements q_0 {
    public final /* synthetic */ fg M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void E() {
        nd_1 a2;
        a2.M.E().E("TTW-ImbalanceTracker", a2.b.M, a2.c);
    }

    @Override
    public void j() {
        nd_1 a2;
        a2.M.E().j(((Zc)a2.c.M).B.E(a2.b.D, ve_2.b, ve_2.J, ve_2.C, false));
    }

    @Override
    public boolean j() {
        return false;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nd_1(fg a2, ze_2 a3, df_0 a4) {
        nd_1 a5;
        a5.M = a2;
        a5.b = a3;
        a5.c = a4;
    }

    @Override
    public boolean E() {
        nd_1 a2;
        return a2.M.E().E();
    }

    @Override
    public String E(boolean a2) {
        nd_1 a3;
        if (a2) {
            return ((Zc)a3.c.M).B.E(a3.b.D, ve_2.b, ve_2.J, ve_2.C, " ");
        }
        return ((Zc)a3.c.M).B.E(a3.b.D, ve_2.b, ve_2.C, " ");
    }
}

