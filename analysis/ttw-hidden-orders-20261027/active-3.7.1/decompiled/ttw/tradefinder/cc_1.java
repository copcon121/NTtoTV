/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_0;
import ttw.tradefinder.hd_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.q_0;
import ttw.tradefinder.sf_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.cc
 */
public class cc_1
implements q_0 {
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ob_1 c;

    @Override
    public void E() {
        cc_1 a2;
        a2.c.E().E(a2.c.E().f(), a2.M.M, a2.b);
    }

    @Override
    public boolean j() {
        return false;
    }

    @Override
    public String E(boolean a2) {
        cc_1 a3;
        if (a2) {
            return ((ua_0)a3.b.M).C.E(a3.M.D, ve_2.Q, ve_2.g, ve_2.R, hd_0.E("7"));
        }
        return ((ua_0)a3.b.M).C.E(a3.M.D, ve_2.Q, ve_2.R, sf_0.E("D"));
    }

    @Override
    public boolean E() {
        cc_1 a2;
        return a2.c.E().E();
    }

    @Override
    public void j() {
        cc_1 a2;
        a2.c.E().j(((ua_0)a2.b.M).C.E(a2.M.D, ve_2.Q, ve_2.g, ve_2.R, false));
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ cc_1(ob_1 a2, ze_2 a3, df_0 a4) {
        cc_1 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }
}

