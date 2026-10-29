/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import ttw.tradefinder.es;
import ttw.tradefinder.wa_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.bf
 */
public class bf_1
extends wa_2<es> {
    private Map<String, Boolean> c = new HashMap<String, Boolean>();

    @Override
    public boolean E() {
        bf_1 a2;
        Iterator<Boolean> iterator = a2.c.values().iterator();
        while (iterator.hasNext()) {
            if (!iterator.next().booleanValue()) continue;
            return true;
        }
        return false;
    }

    public void E(String a2, Boolean a3) {
        bf_1 a4;
        if (a4.c == null) {
            a4.c = new HashMap<String, Boolean>();
        }
        a4.c.put(a2, a3);
    }

    public Boolean E(String a2) {
        bf_1 a3;
        if (a3.c == null) {
            a3.c = new HashMap<String, Boolean>();
        }
        if (!a3.c.containsKey(a2)) {
            a3.c.put(a2, Boolean.FALSE);
        }
        return a3.c.get(a2);
    }

    @Override
    public es E() {
        bf_1 a2;
        es es2 = new es();
        new es().IsDefault = a2.b;
        es es3 = es2;
        es3.b(a2.c);
        return es3;
    }

    @Override
    public void E(String a2) {
        bf_1 a3;
        if (a3.c == null) {
            a3.c = new HashMap<String, Boolean>();
        }
        if (a3.c.containsKey(a2)) {
            a3.c.remove(a2);
        }
    }

    @Override
    public Set<String> E() {
        bf_1 a2;
        return a2.c.keySet();
    }

    public bf_1() {
        super(es.class);
        bf_1 a2;
    }

    @Override
    public void E(bf_1 a2) {
        bf_1 a3;
        Iterator<Map.Entry<String, Boolean>> iterator;
        a2.c.clear();
        Iterator<Map.Entry<String, Boolean>> iterator2 = iterator = a3.c.entrySet().iterator();
        while (iterator2.hasNext()) {
            Map.Entry<String, Boolean> entry = iterator.next();
            a2.c.put(entry.getKey(), entry.getValue());
            iterator2 = iterator;
        }
    }

    @Override
    public void E(es a2) {
        bf_1 a3;
        es es2 = a2;
        a3.b = es2.IsDefault;
        es2.a(a3.c);
    }

    @Override
    public List<String> E() {
        bf_1 a2;
        ArrayList<String> arrayList = new ArrayList<String>();
        for (Map.Entry<String, Boolean> entry : a2.c.entrySet()) {
            if (!entry.getValue().booleanValue()) continue;
            arrayList.add(entry.getKey());
        }
        return arrayList;
    }

    @Override
    public void E() {
        Iterator<String> iterator;
        bf_1 a2;
        if (a2.c == null) {
            a2.c = new HashMap<String, Boolean>();
        }
        Iterator<String> iterator2 = iterator = a2.c.keySet().iterator();
        while (iterator2.hasNext()) {
            String string = iterator.next();
            iterator2 = iterator;
            a2.c.put(string, Boolean.FALSE);
        }
    }
}

