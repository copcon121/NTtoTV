/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.K;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.yc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Wc
 */
public class wc_0
implements g_0 {
    public final /* synthetic */ String C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ f_0 b;
    public final /* synthetic */ yc_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ wc_0(yc_2 a2, ze_2 a3, f_0 a4, String a5) {
        wc_0 a6;
        wc_0 wc_02 = a6;
        wc_02.c = a2;
        wc_02.M = a3;
        a6.b = a4;
        a6.C = a5;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        wc_0 a5;
        if (a4 && !a2.E(a5.M.j) && ((ua_0)a5.c.M.M).j) {
            ((ua_0)a5.c.M.M).j = false;
            wc_0 wc_02 = a5;
            wc_0 wc_03 = a5;
            wc_02.b.E(wc_02.C, wc_03.M.M, a5.c.M);
            wc_03.c.d(((ua_0)a5.c.M.M).j);
        }
    }
}

