/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collections;
import java.util.TimerTask;
import ttw.tradefinder.cf_1;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.sd_1;

/*
 * Renamed from ttw.tradefinder.Ce
 */
public class ce_0
extends TimerTask {
    public final /* synthetic */ boolean C;
    public final /* synthetic */ cf_1 M;
    public final /* synthetic */ String b;
    public final /* synthetic */ int c;

    @Override
    public void run() {
        ce_0 a2;
        Object object = a2.M.C;
        synchronized (object) {
            block6: {
                Object object2;
                block4: {
                    block5: {
                        if (!a2.M.a.containsKey(a2.b) || a2.M.a.get(a2.b) != a2.c) break block4;
                        if (!a2.M.M.contains(a2.b)) break block5;
                        if (a2.C) break block4;
                        object2 = object;
                        a2.M.M.remove(a2.b);
                        a2.M.h.trackEvent(sd_1.E("HQRKSJLZOK"), Collections.singletonMap(a2.b, ra_1.E("\u00067\u0019=\u00027\u0010")), null);
                        break block6;
                    }
                    if (a2.C) {
                        a2.M.M.add(a2.b);
                        a2.M.h.trackEvent(sd_1.E("HQRKSJLZOK"), Collections.singletonMap(a2.b, ra_1.E(">\u001b3\u00107\u0010")), null);
                    }
                }
                object2 = object;
            }
            // ** MonitorExit[v0] (shouldn't be in output)
            return;
        }
    }

    public /* synthetic */ ce_0(cf_1 a2, String a3, int a4, boolean a5) {
        ce_0 a6;
        ce_0 ce_02 = a6;
        ce_02.M = a2;
        ce_02.b = a3;
        a6.c = a4;
        a6.C = a5;
    }
}

