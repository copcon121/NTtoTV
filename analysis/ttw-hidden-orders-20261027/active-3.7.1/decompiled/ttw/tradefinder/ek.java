/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.ia;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=1, compatibleVersions={1})
public class ek
extends ia {
    private Map<String, Color> b = new HashMap<String, Color>();

    public ek() {
        ek a2;
    }

    public void a(String a2, Color a3) {
        ek a4;
        if (a4.b == null) {
            a4.b = new HashMap<String, Color>();
        }
        a4.b.put(a2, a3);
    }

    public Color a(String a2) {
        ek a3;
        if (a3.b == null) {
            a3.b = new HashMap<String, Color>();
        }
        return a3.b.get(a2);
    }

    public void b(Map<String, Color> a2) {
        ek a3;
        if (a3.b == null) {
            a3.b = new HashMap<String, Color>();
        }
        a3.b.clear();
        Object object = a2 = a2.entrySet().iterator();
        while (object.hasNext()) {
            Map.Entry entry = (Map.Entry)a2.next();
            a3.b.put((String)entry.getKey(), (Color)entry.getValue());
            object = a2;
        }
    }

    public void a(Map<String, Color> a2) {
        Iterator<Map.Entry<String, Color>> iterator;
        ek a3;
        if (a3.b == null) {
            a3.b = new HashMap<String, Color>();
        }
        a2.clear();
        Iterator<Map.Entry<String, Color>> iterator2 = iterator = a3.b.entrySet().iterator();
        while (iterator2.hasNext()) {
            Map.Entry<String, Color> entry = iterator.next();
            a2.put(entry.getKey(), entry.getValue());
            iterator2 = iterator;
        }
    }
}

