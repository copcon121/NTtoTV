/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.ia;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=1, compatibleVersions={1})
public class es
extends ia {
    private Map<String, Boolean> b = new HashMap<String, Boolean>();

    public es() {
        es a2;
    }

    public void a(Map<String, Boolean> a2) {
        es a3;
        Iterator<Map.Entry<String, Boolean>> iterator;
        a2.clear();
        Iterator<Map.Entry<String, Boolean>> iterator2 = iterator = a3.b.entrySet().iterator();
        while (iterator2.hasNext()) {
            Map.Entry<String, Boolean> entry = iterator.next();
            a2.put(entry.getKey(), entry.getValue());
            iterator2 = iterator;
        }
    }

    public void b(Map<String, Boolean> a2) {
        es a3;
        a3.b.clear();
        Object object = a2 = a2.entrySet().iterator();
        while (object.hasNext()) {
            Map.Entry entry = (Map.Entry)a2.next();
            a3.b.put((String)entry.getKey(), (Boolean)entry.getValue());
            object = a2;
        }
    }
}

