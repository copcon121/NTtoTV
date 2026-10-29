/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BiConsumer;
import ttw.tradefinder.hK;
import ttw.tradefinder.na_0;
import ttw.tradefinder.wa_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.oa
 */
public class oa_0
extends wa_2<hK> {
    private Object b = new Object();
    private Map<Integer, na_0> c = new LinkedHashMap<Integer, na_0>();

    public void j(int a2) {
        oa_0 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            if (!a3.c.containsKey(a2)) {
                return;
            }
            a3.c.get((Object)Integer.valueOf((int)a2)).C = false;
            return;
        }
    }

    public int E(na_0 a2, int a3) {
        oa_0 a4;
        Object object = a4.b;
        synchronized (object) {
            if (a4.c == null) {
                a4.c = new LinkedHashMap<Integer, na_0>();
            }
            int n2 = 0;
            oa_0 oa_02 = a4;
            while (oa_02.c.containsKey(n2)) {
                oa_02 = a4;
                ++n2;
            }
            LinkedHashMap<Integer, na_0> linkedHashMap = new LinkedHashMap<Integer, na_0>();
            for (Map.Entry<Integer, na_0> entry : a4.c.entrySet()) {
                linkedHashMap.put(entry.getKey(), entry.getValue());
                if (entry.getKey() != a3) continue;
                linkedHashMap.put(n2, a2);
            }
            if (!linkedHashMap.containsKey(n2)) {
                linkedHashMap.put(n2, a2);
            }
            oa_0 oa_03 = a4;
            oa_03.c.clear();
            oa_03.c.putAll(linkedHashMap);
            return n2;
        }
    }

    public na_0 E(int a2) {
        oa_0 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            if (a3.c.containsKey(a2)) {
                return a3.c.get(a2);
            }
        }
        return new na_0();
    }

    public oa_0() {
        super(hK.class);
        oa_0 a2;
    }

    @Override
    public void E(int a2) {
        oa_0 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            if (!a3.c.containsKey(a2)) {
                return;
            }
            a3.c.remove(a2);
            return;
        }
    }

    @Override
    public void E() {
        oa_0 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.c == null) {
                a2.c = new LinkedHashMap<Integer, na_0>();
            }
            a2.c.clear();
            return;
        }
    }

    @Override
    public void E(BiConsumer<Integer, na_0> a2) {
        oa_0 a3;
        Object object = new LinkedHashMap<Integer, na_0>();
        Iterator<Map.Entry<Integer, na_0>> iterator = a3.b;
        synchronized (iterator) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            object.putAll(a3.c);
        }
        Iterator<Map.Entry<Integer, na_0>> iterator2 = iterator = a3.c.entrySet().iterator();
        while (iterator2.hasNext()) {
            object = iterator.next();
            a2.accept((Integer)object.getKey(), (na_0)object.getValue());
            iterator2 = iterator;
        }
    }

    @Override
    public int E() {
        oa_0 a2;
        Object object = a2.b;
        synchronized (object) {
            if (a2.c == null) {
                a2.c = new LinkedHashMap<Integer, na_0>();
            }
            return a2.c.size();
        }
    }

    public int E(na_0 a2) {
        oa_0 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            int n2 = 0;
            oa_0 oa_02 = a3;
            while (oa_02.c.containsKey(n2)) {
                oa_02 = a3;
                ++n2;
            }
            a3.c.put(n2, a2);
            return n2;
        }
    }

    @Override
    public void E(hK a2) {
        oa_0 a3;
        Object object = a3.b = (Object)a2.IsDefault;
        synchronized (object) {
            if (a3.c == null) {
                a3.c = new LinkedHashMap<Integer, na_0>();
            }
            a2.a(a3.c);
            return;
        }
    }

    @Override
    public hK E() {
        oa_0 a2;
        hK hK2 = new hK();
        new hK().IsDefault = a2.b;
        Object object = a2.b;
        synchronized (object) {
            if (a2.c == null) {
                a2.c = new LinkedHashMap<Integer, na_0>();
            }
            hK2.b(a2.c);
            return hK2;
        }
    }
}

