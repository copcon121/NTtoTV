/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.Ff;
import ttw.tradefinder.Jd;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.cd_2;
import ttw.tradefinder.cf_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.j_0;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.pb_2;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.s_0;
import ttw.tradefinder.ze_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.XB
 */
public abstract class xb_2 {
    public final f_0 D;
    private final Object A;
    private final Map<ff_1, List<WeakReference<j_0>>> C;
    public final ze_2 M;
    private List<cd_2> b;
    private final s_0 c;

    public void E(ff_1 a2) {
    }

    public void E(String a2, String a3) {
        xb_2 a4;
        a4.D.j(a2, a3);
    }

    public void E(ff_1 a2, Double a3, long a4) {
        xb_2 a5;
        Object object = a5.A;
        synchronized (object) {
            if (!a5.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a5.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4);
            }
            return;
        }
    }

    public void l(long a2) {
        xb_2 a3;
        Iterator<cd_2> iterator;
        Iterator<cd_2> iterator2 = iterator = a3.b.iterator();
        while (iterator2.hasNext()) {
            iterator.next().E(a2);
            iterator2 = iterator;
        }
    }

    public void E(ff_1 a2, Ff a3) {
    }

    public void j(ff_1 a2, int a3, cc_0 a4, long a5, long a6) {
        xb_2 a7;
        Object object = a7.A;
        synchronized (object) {
            if (!a7.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a7.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4, a5, a6);
            }
            return;
        }
    }

    public void E(ff_1 a2, int a3, boolean a4, long a5) {
    }

    public void E(ff_1 a2, int a3, Jd a4, long a5) {
    }

    public void E(ff_1 a2, oe_1 a3, boolean a4) {
    }

    public void H(long a2) {
    }

    public void E(oe_1 a2, boolean a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            for (Map.Entry<ff_1, List<WeakReference<j_0>>> entry : a4.C.entrySet()) {
                for (WeakReference<j_0> weakReference : entry.getValue()) {
                    if (weakReference.get() == null) continue;
                    ((j_0)weakReference.get()).E(entry.getKey(), a2, a3);
                }
            }
            return;
        }
    }

    public void E(cd_2 a2) {
        xb_2 a3;
        a3.b.add(a2);
    }

    public void j(ff_1 a2, j_0 a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            int n2;
            if (!a4.C.containsKey((Object)a2)) {
                return;
            }
            a4.C.get((Object)a2).add(new WeakReference<j_0>(a3));
            oe_1[] oe_1Array = oe_1.values();
            int n3 = oe_1Array.length;
            int n4 = n2 = 0;
            while (n4 < n3) {
                oe_1 oe_12 = oe_1Array[n2];
                ff_1 ff_12 = a2;
                a3.E(ff_12, oe_12, a4.E(ff_12, oe_12));
                n4 = ++n2;
            }
            return;
        }
    }

    public void j(ff_1 a2, jf_1 a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            if (!a4.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a4.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3);
            }
            return;
        }
    }

    public void a(ff_1 a2) {
        xb_2 a3;
        Object object = a3.A;
        synchronized (object) {
            if (a3.C.containsKey((Object)a2)) {
                return;
            }
            a3.C.put(a2, new ArrayList());
            return;
        }
    }

    public cf_2 E() {
        xb_2 a2;
        xb_2 xb_22 = a2;
        return xb_22.D.E(xb_22.M.M);
    }

    public void E(j_0 a2) {
        xb_2 a3;
        Object object = a3.A;
        synchronized (object) {
            block4: for (List<WeakReference<j_0>> list : a3.C.values()) {
                Iterator<WeakReference<j_0>> object2 = list.iterator();
                block5: while (true) {
                    Iterator<WeakReference<j_0>> iterator = object2;
                    while (iterator.hasNext()) {
                        WeakReference<j_0> weakReference = object2.next();
                        if (weakReference.get() == null) {
                            Iterator<WeakReference<j_0>> iterator2 = object2;
                            iterator = iterator2;
                            iterator2.remove();
                            continue;
                        }
                        if (weakReference.get() != a2) continue block5;
                        weakReference.clear();
                        object2.remove();
                        continue block5;
                    }
                    continue block4;
                    break;
                }
            }
            return;
        }
    }

    public void j(ff_1 a2, int a3, Jd a4, long a5) {
        xb_2 a6;
        Object object = a6.A;
        synchronized (object) {
            if (!a6.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a6.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4, a5);
            }
            return;
        }
    }

    public void E(ff_1 a2, int a3, Jd a4, long a5, long a6) {
    }

    public void E(ff_1 a2, double a3, long a4) {
    }

    public void j(ff_1 a2, pb_2 a3, long a4) {
        xb_2 a5;
        Object object = a5.A;
        synchronized (object) {
            if (!a5.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a5.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4);
            }
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     */
    public boolean E(ff_1 a2, oe_1 a3) {
        switch (a3) {
            case M: {
                return true;
            }
            case c: {
                return false;
            }
            case b: {
                return true;
            }
        }
        return true;
    }

    public void j(boolean a2) {
        xb_2 a3;
        xb_2 xb_22 = a3;
        xb_22.c.E(xb_22.M.M, a2);
    }

    public void E(ff_1 a2, pb_2 a3, long a4) {
    }

    public void j() {
        xb_2 a2;
        for (List<WeakReference<j_0>> list : a2.C.values()) {
            Iterator<WeakReference<j_0>> iterator = list.iterator();
            while (iterator.hasNext()) {
                Iterator<WeakReference<j_0>> object;
                object.next().clear();
                iterator = object;
            }
        }
        a2.C.clear();
    }

    public void j(ff_1 a2) {
        xb_2 a3;
        Object object = a3.A;
        synchronized (object) {
            if (!a3.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a3.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2);
            }
            return;
        }
    }

    public void j(ff_1 a2, int a3, boolean a4, long a5) {
        xb_2 a6;
        Object object = a6.A;
        synchronized (object) {
            if (!a6.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a6.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4, a5);
            }
            return;
        }
    }

    public qc_1 E() {
        xb_2 a2;
        return a2.D.E();
    }

    public void E(ff_1 a2, jf_1 a3) {
    }

    public void j(ff_1 a2, jf_0 a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            if (!a4.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a4.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3);
            }
            return;
        }
    }

    public void E(ff_1 a2, j_0 a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            if (!a4.C.containsKey(a2)) {
                return;
            }
            a2 = a4.C.get(a2).iterator();
            block3: while (true) {
                Object object2 = a2;
                while (object2.hasNext()) {
                    WeakReference weakReference = (WeakReference)a2.next();
                    if (weakReference.get() == null) {
                        Object object3 = a2;
                        object2 = object3;
                        object3.remove();
                        continue;
                    }
                    if (weakReference.get() != a3) continue block3;
                    weakReference.clear();
                    a2.remove();
                    continue block3;
                }
                break;
            }
            return;
        }
    }

    public void j(ff_1 a2, Ff a3) {
        xb_2 a4;
        Object object = a4.A;
        synchronized (object) {
            if (!a4.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a4.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3);
            }
            return;
        }
    }

    public void E(qd_2 a2) {
        xb_2 a3;
        a3.D.E(a2);
    }

    public void E() {
        xb_2 a2;
        Iterator<cd_2> iterator;
        Iterator<cd_2> iterator2 = iterator = a2.b.iterator();
        while (iterator2.hasNext()) {
            iterator.next().E();
            iterator2 = iterator;
        }
    }

    public void E(ff_1 a2, int a3, cc_0 a4, long a5, long a6) {
    }

    public void j(ff_1 a2, int a3, Jd a4, long a5, long a6) {
        xb_2 a7;
        Object object = a7.A;
        synchronized (object) {
            if (!a7.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a7.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4, a5, a6);
            }
            return;
        }
    }

    public xb_2(f_0 a2, ze_2 a3, s_0 a4) {
        xb_2 a5;
        xb_2 xb_22 = a5;
        xb_2 xb_23 = a5;
        a5.A = new Object();
        xb_23.C = new HashMap<ff_1, List<WeakReference<j_0>>>();
        xb_23.b = Collections.synchronizedList(new ArrayList());
        xb_23.D = a2;
        xb_22.M = a3;
        xb_22.c = a4;
    }

    public void j(ff_1 a2, oe_1 a3, boolean a4) {
        xb_2 a5;
        Object object = a5.A;
        synchronized (object) {
            if (!a5.C.containsKey((Object)a2)) {
                return;
            }
            for (WeakReference<j_0> weakReference : a5.C.get((Object)a2)) {
                if (weakReference.get() == null) continue;
                ((j_0)weakReference.get()).E(a2, a3, a4);
            }
            return;
        }
    }

    public void E(ff_1 a2, jf_0 a3) {
    }
}

