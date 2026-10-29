/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import ttw.tradefinder.hL;
import ttw.tradefinder.ia;
import ttw.tradefinder.na_0;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=3, compatibleVersions={3})
public class hK
extends ia {
    private Map<Integer, hL> c = new LinkedHashMap<Integer, hL>();

    public void b(Map<Integer, na_0> a2) {
        hK a3;
        if (a3.c == null) {
            a3.c = new LinkedHashMap<Integer, hL>();
        }
        a3.c.clear();
        Object object = a2 = a2.entrySet().iterator();
        while (object.hasNext()) {
            Map.Entry entry = (Map.Entry)a2.next();
            a3.c.put((Integer)entry.getKey(), ((na_0)entry.getValue()).ttw_tradefinder_hL_E());
            object = a2;
        }
    }

    public void a(int a2, hL a3) {
        hK a4;
        if (a4.c == null) {
            a4.c = new LinkedHashMap<Integer, hL>();
        }
        a4.c.put(a2, a3);
    }

    public void a(Map<Integer, na_0> a2) {
        Iterator<Map.Entry<Integer, hL>> iterator;
        hK a3;
        if (a3.c == null) {
            a3.c = new LinkedHashMap<Integer, hL>();
        }
        a2.clear();
        Iterator<Map.Entry<Integer, hL>> iterator2 = iterator = a3.c.entrySet().iterator();
        while (iterator2.hasNext()) {
            Map.Entry<Integer, hL> entry = iterator.next();
            na_0 na_02 = new na_0();
            na_02.E(entry.getValue());
            a2.put(entry.getKey(), na_02);
            iterator2 = iterator;
        }
    }

    public hK() {
        hK a2;
    }

    public hL a(int a2) {
        hK a3;
        if (a3.c == null) {
            a3.c = new LinkedHashMap<Integer, hL>();
        }
        if (a3.c.containsKey(a2)) {
            return a3.c.get(a2);
        }
        return new hL();
    }
}

