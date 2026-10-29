/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.LinkedHashMap;
import java.util.TimerTask;
import ttw.tradefinder.cf_1;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.re_1;

/*
 * Renamed from ttw.tradefinder.zD
 */
public class zd_1
extends TimerTask {
    public final /* synthetic */ cf_1 c;

    @Override
    public void run() {
        zd_1 a2;
        Object object = a2.c.C;
        synchronized (object) {
            a2.c.b = true;
            a2.c.H.addAll(a2.c.c.E());
            LinkedHashMap<String, String> linkedHashMap = new LinkedHashMap<String, String>();
            linkedHashMap.put("loaded", String.join((CharSequence)",", a2.c.M));
            linkedHashMap.put("enabled", String.join((CharSequence)",", a2.c.H));
            a2.c.h.trackEvent("start-up-instruments", linkedHashMap, null);
            return;
        }
    }

    public /* synthetic */ zd_1(cf_1 a2) {
        zd_1 a3;
        a3.c = a2;
    }
}

