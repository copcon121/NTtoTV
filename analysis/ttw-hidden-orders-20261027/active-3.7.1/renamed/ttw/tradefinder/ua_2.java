/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.K;
import ttw.tradefinder.dc_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.g_0;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.wc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.UA
 */
public class ua_2
implements g_0 {
    public final /* synthetic */ f_0 C;
    public final /* synthetic */ wc_2 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ua_2(wc_2 a2, f_0 a3, String a4, ze_2 a5) {
        ua_2 a6;
        ua_2 ua_22 = a6;
        ua_22.M = a2;
        ua_22.C = a3;
        a6.b = a4;
        a6.c = a5;
    }

    @Override
    public void E(K a2, boolean a3, boolean a4) {
        ua_2 a5;
        if (a4 && !a3 && ((dc_2)a5.M.K.M).b == mb_2.c) {
            ((dc_2)a5.M.K.M).b = mb_2.C;
            ua_2 ua_22 = a5;
            ua_22.C.E(ua_22.b, a5.c.M, a5.M.K);
        }
    }
}

