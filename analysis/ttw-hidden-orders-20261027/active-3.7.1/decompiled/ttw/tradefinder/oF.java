/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.df_0;
import ttw.tradefinder.lg;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ra;
import ttw.tradefinder.sd_1;
import ttw.tradefinder.se_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class oF
implements q_0 {
    public final /* synthetic */ lg M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    @Override
    public void E() {
        oF a2;
        a2.M.E().E(se_0.E("j>iGs\u000bL\u0001[\u001e{\u0012N\u0006Q\u0018[\u0018"), a2.c.M, a2.b);
    }

    @Override
    public boolean j() {
        return false;
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ oF(lg a2, ze_2 a3, df_0 a4) {
        oF a5;
        a5.M = a2;
        a5.c = a3;
        a5.b = a4;
    }

    @Override
    public String E(boolean a2) {
        oF a3;
        if (a2) {
            return ((ra)a3.b.M).b.E(a3.c.D, ve_2.G, ve_2.c, ve_2.B, sd_1.E("\u001f"));
        }
        return ((ra)a3.b.M).b.E(a3.c.D, ve_2.G, ve_2.B, se_0.E("J"));
    }

    @Override
    public boolean E() {
        oF a2;
        return a2.M.E().E();
    }

    @Override
    public void j() {
        oF a2;
        a2.M.E().j(((ra)a2.b.M).b.E(a2.c.D, ve_2.G, ve_2.c, ve_2.B, false));
    }
}

