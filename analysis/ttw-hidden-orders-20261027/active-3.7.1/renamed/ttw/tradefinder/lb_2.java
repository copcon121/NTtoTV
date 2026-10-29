/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.c_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.j_0;
import ttw.tradefinder.ne_2;
import ttw.tradefinder.s_0;
import ttw.tradefinder.v_0;
import ttw.tradefinder.x_0;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.z_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.lb
 */
public abstract class lb_2
implements s_0,
z_0 {
    private final f_0 H;
    private String D;
    private v_0 A;
    private final Map<String, c_0> C;
    private List<ne_2> M;
    private final Object b;
    private final Map<String, Map<ff_1, List<WeakReference<j_0>>>> c;

    @Override
    public void void_E(String a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            if (a3.C.containsKey(a2)) {
                a2 = a3.C.remove(a2);
                a2.void_j();
                if (a3.A != null) {
                    a3.A.E((j_0)a2);
                }
            }
            return;
        }
    }

    public void j(String a2, x_0 a3) {
        lb_2 a4;
        a4.H.E(a2, a3);
    }

    public abstract /* synthetic */ void j(String var1, boolean var2);

    public f_0 ttw_tradefinder_f_0_E() {
        lb_2 a2;
        return a2.H;
    }

    public void a(String a2) {
        lb_2 a3;
        a3.H.void_E(a2);
    }

    public void a(String a2, ff_1 a3, j_0 a4) {
        lb_2 a5;
        if (a5.A != null) {
            a5.A.E(a2, a3, a4);
        }
    }

    @Override
    public void E(j_0 a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            Iterator<Object> iterator = a3.C.values().iterator();
            Iterator<Object> iterator2 = iterator;
            while (iterator2.hasNext()) {
                c_0 iterator3 = iterator.next();
                iterator3.E(a2);
                iterator2 = iterator;
            }
            for (Map map : a3.c.values()) {
                for (Object object2 : map.values()) {
                    object2 = object2.iterator();
                    while (object2.hasNext()) {
                        WeakReference weakReference = (WeakReference)object2.next();
                        if (weakReference.get() != null && weakReference.get() != a2) continue;
                        object2.remove();
                    }
                }
            }
            return;
        }
    }

    public void E(String a2, x_0 a3) {
        lb_2 a4;
        a4.H.j(a2, a3);
    }

    public void E(String a2, c_0 a3) {
        lb_2 a4;
        Object object = a4.b;
        synchronized (object) {
            block7: {
                if (!a4.c.containsKey(a2)) break block7;
                for (Map.Entry<ff_1, List<WeakReference<j_0>>> entry : a4.c.get(a2).entrySet()) {
                    Iterator<WeakReference<j_0>> iterator = entry.getValue().iterator();
                    while (iterator.hasNext()) {
                        Iterator<WeakReference<j_0>> iterator2;
                        WeakReference<j_0> weakReference = iterator2.next();
                        if (weakReference.get() == null) {
                            Iterator<WeakReference<j_0>> iterator3 = iterator2;
                            iterator = iterator3;
                            iterator3.remove();
                            continue;
                        }
                        a3.j(entry.getKey(), (j_0)weakReference.get());
                        iterator = iterator2;
                    }
                }
            }
            return;
        }
    }

    public abstract /* synthetic */ c_0 E(f_0 var1, ze_2 var2, xf_2 var3);

    @Override
    public List<String> E() {
        lb_2 a2;
        ArrayList<String> arrayList = new ArrayList<String>();
        Object object = a2.b;
        synchronized (object) {
            Iterator<Map.Entry<String, c_0>> iterator;
            Iterator<Map.Entry<String, c_0>> iterator2 = iterator = a2.C.entrySet().iterator();
            while (iterator2.hasNext()) {
                Map.Entry<String, c_0> entry = iterator.next();
                arrayList.add(entry.getKey());
                iterator2 = iterator;
            }
            return arrayList;
        }
    }

    public c_0 ttw_tradefinder_c_0_E(String a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            return a3.C.get(a2);
        }
    }

    public c_0 ttw_tradefinder_c_0_E(ze_2 a2, xf_2 a322) {
        lb_2 a4;
        Object object = a4.b;
        synchronized (object) {
            c_0 c_02;
            block9: {
                c_02 = a4.C.get(((ze_2)((Object)a2)).M);
                if (c_02 != null) {
                    return c_02;
                }
                lb_2 lb_22 = a4;
                c_02 = lb_22.E(lb_22.H, (ze_2)((Object)a2), (xf_2)a322);
                if (c_02 instanceof x_0) {
                    a4.E(((ze_2)((Object)a2)).M, (x_0)((Object)c_02));
                }
                lb_2 lb_23 = a4;
                lb_23.C.put(((ze_2)((Object)a2)).M, c_02);
                if (!lb_23.c.containsKey(((ze_2)((Object)a2)).M)) break block9;
                for (Map.Entry<ff_1, List<WeakReference<j_0>>> a322 : a4.c.get(((ze_2)((Object)a2)).M).entrySet()) {
                    Iterator<WeakReference<j_0>> iterator = a322.getValue().iterator();
                    while (iterator.hasNext()) {
                        Iterator<WeakReference<j_0>> iterator2;
                        WeakReference<j_0> weakReference = iterator2.next();
                        if (weakReference.get() == null) {
                            Iterator<WeakReference<j_0>> iterator3 = iterator2;
                            iterator = iterator3;
                            iterator3.remove();
                            continue;
                        }
                        c_02.j(a322.getKey(), (j_0)weakReference.get());
                        iterator = iterator2;
                    }
                }
            }
            return c_02;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    @Override
    public void E(String a2, ff_1 a32, j_0 a4) {
        lb_2 a5;
        Object object = a5.b;
        synchronized (object) {
            WeakReference<j_0> weakReference;
            if (a5.C.containsKey(a2)) {
                a5.C.get(a2).j((ff_1)((Object)a32), (j_0)a4);
            }
            if (!a5.c.containsKey(a2)) {
                a5.c.put((String)a2, new HashMap());
            }
            if (!(a2 = a5.c.get(a2)).containsKey(a32)) {
                a2.put((ff_1)((Object)a32), new ArrayList());
            }
            a2 = a2.get(a32);
            Iterator<WeakReference<j_0>> a32 = a2.iterator();
            block3: do {
                Iterator<WeakReference<j_0>> iterator = a32;
                while (true) {
                    if (!iterator.hasNext()) {
                        a2.add(new WeakReference<void>(a4));
                        return;
                    }
                    weakReference = a32.next();
                    if (weakReference.get() != null) continue block3;
                    Iterator<WeakReference<j_0>> iterator2 = a32;
                    iterator = iterator2;
                    iterator2.remove();
                }
            } while (weakReference.get() != a4);
            return;
        }
    }

    @Override
    public String java_lang_String_E() {
        lb_2 a2;
        return a2.D;
    }

    @Override
    public void j(String a2, ff_1 a3, j_0 a4) {
        lb_2 a5;
        Object object = a5.b;
        synchronized (object) {
            if (a5.C.containsKey(a2)) {
                a5.C.get(a2).E((ff_1)((Object)a3), a4);
            }
            if (a5.c.containsKey(a2) && (a2 = a5.c.get(a2)).containsKey(a3)) {
                a2 = ((List)a2.get(a3)).iterator();
                while (a2.hasNext()) {
                    a3 = (WeakReference)a2.next();
                    if (((Reference)a3).get() != null && ((Reference)a3).get() != a4) continue;
                    a2.remove();
                }
            }
            return;
        }
    }

    @Override
    public void void_j(String a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            if (!a3.C.containsKey(a2)) {
                return;
            }
            a2 = a3.C.get(a2);
            a2.void_E(true);
            a2.void_E();
            return;
        }
    }

    @Override
    public void j(long a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            Iterator<c_0> iterator;
            Iterator<c_0> iterator2 = iterator = a3.C.values().iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_j(a2);
                iterator2 = iterator;
            }
            return;
        }
    }

    @Override
    public void void_E(ze_2 a2, xf_2 a3) {
        lb_2 a4;
        Object object = a4.b;
        synchronized (object) {
            a4.ttw_tradefinder_c_0_E(a2, a3);
            return;
        }
    }

    @Override
    public void void_E(String a2, boolean a3) {
        lb_2 a4;
        if (!a4.H.E().contains(a2)) {
            return;
        }
        a4.j(a2, a3);
    }

    public List<String> a() {
        lb_2 a2;
        ArrayList<String> arrayList = new ArrayList<String>();
        Object object = a2.b;
        synchronized (object) {
            for (Map.Entry<String, c_0> entry : a2.C.entrySet()) {
                if (!entry.getValue().boolean_E()) continue;
                arrayList.add(entry.getKey());
            }
            return arrayList;
        }
    }

    @Override
    public List<ne_2> j() {
        lb_2 a2;
        return a2.M;
    }

    public lb_2(f_0 a2, String a3, v_0 a4) {
        lb_2 a5;
        lb_2 lb_22 = a5;
        lb_2 lb_23 = a5;
        lb_2 lb_24 = a5;
        lb_24.D = "";
        a5.b = new Object();
        lb_24.C = new HashMap<String, c_0>();
        lb_23.c = new HashMap<String, Map<ff_1, List<WeakReference<j_0>>>>();
        lb_23.M = new ArrayList<ne_2>();
        lb_23.H = a2;
        lb_22.D = a3;
        lb_22.A = a4;
    }

    @Override
    public void E(ne_2 a2) {
        lb_2 a3;
        a3.M.add(a2);
    }

    @Override
    public void a() {
        lb_2 a2;
        Object object = a2.c.values().iterator();
        while (object.hasNext()) {
            Map<ff_1, List<WeakReference<j_0>>> map = object.next();
            for (List<WeakReference<j_0>> list : map.values()) {
                Iterator<WeakReference<j_0>> iterator = list.iterator();
                while (iterator.hasNext()) {
                    Iterator<WeakReference<j_0>> iterator2;
                    iterator2.next().clear();
                    iterator = iterator2;
                }
            }
        }
        lb_2 lb_22 = a2;
        lb_22.c.clear();
        Object object2 = object = lb_22.M.iterator();
        while (object2.hasNext()) {
            ne_2 ne_22 = (ne_2)object.next();
            ne_22.void_E();
            object2 = object;
        }
        object = a2.b;
        synchronized (object) {
            Iterator<c_0> iterator;
            Iterator<c_0> iterator3 = iterator = a2.C.values().iterator();
            while (iterator3.hasNext()) {
                c_0 c_02 = iterator.next();
                c_02.void_j();
                iterator3 = iterator;
            }
        }
        a2.C.clear();
    }

    @Override
    public void E(long a2) {
        lb_2 a3;
        Object object = a3.b;
        synchronized (object) {
            Iterator<c_0> iterator;
            Iterator<c_0> iterator2 = iterator = a3.C.values().iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_E(a2);
                iterator2 = iterator;
            }
            return;
        }
    }
}

