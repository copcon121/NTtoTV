/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Zc;
import ttw.tradefinder.be_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.gc_1;
import ttw.tradefinder.q_0;
import ttw.tradefinder.ve_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.hE
 */
public class he_0
implements q_0 {
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ fg c;

    @Override
    public void void_j() {
        he_0 a2;
        a2.c.ttw_tradefinder_f_0_E().j(((Zc)a2.M.M).D.E(a2.b.D, ve_2.l, ve_2.I, ve_2.a, false));
    }

    @Override
    public boolean boolean_E() {
        he_0 a2;
        return a2.c.ttw_tradefinder_f_0_E().boolean_E();
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ he_0(fg a2, ze_2 a3, df_0 a4) {
        he_0 a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }

    @Override
    public String E(boolean a2) {
        he_0 a3;
        if (a2) {
            return ((Zc)a3.M.M).D.E(a3.b.D, ve_2.l, ve_2.I, ve_2.a, be_0.E("\u001d"));
        }
        return ((Zc)a3.M.M).D.E(a3.b.D, ve_2.l, ve_2.a, gc_1.E("B"));
    }

    @Override
    public void void_E() {
        he_0 a2;
        a2.c.ttw_tradefinder_f_0_E().E(gc_1.E("f6eO{\u000fP\u0003^\u0003\\\u0001W6@\u0003Q\tW\u0010"), a2.b.M, a2.M);
    }

    @Override
    public boolean boolean_j() {
        return false;
    }
}

