/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collections;
import java.util.TimerTask;
import ttw.tradefinder.bC;
import ttw.tradefinder.cf_1;
import ttw.tradefinder.pb_2;

/*
 * Renamed from ttw.tradefinder.GE
 */
public class ge_2
extends TimerTask {
    public final /* synthetic */ int C;
    public final /* synthetic */ cf_1 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ boolean c;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     * Converted monitor instructions to comments
     * Lifted jumps to return sites
     */
    @Override
    public void run() {
        Object object;
        ge_2 a2;
        Object object2 = a2.M.C;
        // MONITORENTER : object2
        if (a2.M.A.containsKey(a2.b) && a2.M.A.get(a2.b) == a2.C) {
            if (a2.M.H.contains(a2.b)) {
                ge_2 ge_22 = a2;
                if (a2.c) {
                    ge_22.M.h.trackEvent("instrument", Collections.singletonMap(a2.b, "reload"), null);
                    object = object2;
                    return;
                }
                ge_22.M.H.remove(a2.b);
                a2.M.h.trackEvent("instrument", Collections.singletonMap(a2.b, "disabled"), null);
                object = object2;
                return;
            }
            if (a2.c) {
                a2.M.H.add(a2.b);
                a2.M.h.trackEvent("instrument", Collections.singletonMap(a2.b, "enabled"), null);
            }
        }
        object = object2;
        // MONITOREXIT : object
    }

    public /* synthetic */ ge_2(cf_1 a2, String a3, int a4, boolean a5) {
        ge_2 a6;
        ge_2 ge_22 = a6;
        ge_22.M = a2;
        ge_22.b = a3;
        a6.C = a4;
        a6.c = a5;
    }
}

