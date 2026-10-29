/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import ttw.tradefinder.be_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.i_0;
import ttw.tradefinder.jc_0;
import ttw.tradefinder.zc_2;

/*
 * Renamed from ttw.tradefinder.uB
 */
public class ub_1 {
    private static final int E = 6;
    private boolean j;
    private int a;
    private String h;
    private List<WeakReference<i_0>> H;
    private cd D;
    private boolean A;
    private static final String C;
    private static final String M;
    private Object b;
    private String c;

    public /* synthetic */ boolean a() {
        ub_1 a2;
        return a2.h.equals("ABORT") && a2.c.equals("ABORT");
    }

    public /* synthetic */ void E(boolean a22) {
        ub_1 a3;
        ub_1 ub_12 = a3;
        ub_12.a = 0;
        ub_12.E();
        if (ub_12.j == a22 && a3.A) {
            return;
        }
        ub_1 ub_13 = a3;
        ub_13.A = true;
        ub_13.j = a22;
        Object a22 = new ArrayList<WeakReference<i_0>>();
        Iterator iterator = a3.b;
        synchronized (iterator) {
            a22.addAll(a3.H);
        }
        Iterator iterator2 = iterator = a22.iterator();
        while (iterator2.hasNext()) {
            a22 = (WeakReference)iterator.next();
            if (((Reference)a22).get() == null) {
                Iterator iterator3 = iterator;
                iterator2 = iterator3;
                iterator3.remove();
                continue;
            }
            ub_1 ub_14 = a3;
            ((i_0)((Reference)a22).get()).E(ub_14.D, ub_14.j, a3.A);
            iterator2 = iterator;
        }
    }

    public /* synthetic */ void a() {
        ub_1 a2;
        if (++a2.a >= 6) {
            a2.E(false);
        }
    }

    public /* synthetic */ boolean j() {
        ub_1 a2;
        return a2.A && a2.j;
    }

    public /* synthetic */ boolean E() {
        ub_1 a2;
        return a2.a > 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     * Converted monitor instructions to comments
     * Lifted jumps to return sites
     */
    public /* synthetic */ void j(i_0 a2) {
        Object object;
        WeakReference<i_0> weakReference;
        ub_1 a3;
        Object object2 = a3.b;
        // MONITORENTER : object2
        Iterator<WeakReference<i_0>> iterator = a3.H.iterator();
        block3: do {
            Iterator<WeakReference<i_0>> iterator2 = iterator;
            while (true) {
                if (!iterator2.hasNext()) {
                    object = object2;
                    // MONITOREXIT : object
                    return;
                }
                weakReference = iterator.next();
                if (weakReference.get() != null) continue block3;
                Iterator<WeakReference<i_0>> iterator3 = iterator;
                iterator2 = iterator3;
                iterator3.remove();
            }
        } while (weakReference.get() != a2);
        object = object2;
        weakReference.clear();
        iterator.remove();
    }

    public /* synthetic */ String j() {
        ub_1 a2;
        return a2.c;
    }

    public /* synthetic */ ub_1(String a2, cd a3) {
        ub_1 a4;
        ub_1 ub_12 = a4;
        ub_1 ub_13 = a4;
        ub_1 ub_14 = a4;
        a4.b = new Object();
        a4.H = new ArrayList<WeakReference<i_0>>();
        ub_14.a = 0;
        ub_14.A = false;
        ub_13.j = false;
        ub_13.h = a2;
        a4.D = a3;
        a4.c = zc_2.j(a3);
        a4.H.clear();
        ub_12.a = 0;
        ub_12.A = false;
    }

    public /* synthetic */ void E(String a2) {
        ub_1 a3;
        if (a3.h.equals(a2)) {
            return;
        }
        ub_1 ub_12 = a3;
        ub_12.h = a2;
        ub_12.A = false;
        a3.j = false;
    }

    public /* synthetic */ void j() {
        ub_1 a2;
        Object object = a2.b;
        synchronized (object) {
            Iterator<WeakReference<i_0>> iterator;
            Iterator<WeakReference<i_0>> iterator2 = iterator = a2.H.iterator();
            while (iterator2.hasNext()) {
                iterator.next().clear();
                iterator2 = iterator;
            }
            a2.H.clear();
            return;
        }
    }

    private /* synthetic */ boolean E(i_0 a2) {
        ub_1 a3;
        for (WeakReference<i_0> weakReference : a3.H) {
            if (weakReference.get() == null || weakReference.get() != a2) continue;
            return true;
        }
        return false;
    }

    private /* synthetic */ void E() {
        ub_1 a2;
        Object object = a2.b;
        synchronized (object) {
            Iterator<WeakReference<i_0>> iterator = a2.H.iterator();
            while (iterator.hasNext()) {
                if (iterator.next().get() != null) continue;
                iterator.remove();
            }
            return;
        }
    }

    public /* synthetic */ int E() {
        ub_1 a2;
        Object object = a2.b;
        synchronized (object) {
            return a2.H.size();
        }
    }

    public /* synthetic */ String E() {
        ub_1 a2;
        return a2.h;
    }

    public /* synthetic */ cd E() {
        ub_1 a2;
        return a2.D;
    }

    private /* synthetic */ ub_1(String a2, String a3) {
        a4(a2, zc_2.E(a3));
        ub_1 a4;
        a4.c = a3;
    }

    public /* synthetic */ void E(i_0 a2) {
        ub_1 a3;
        Object object = a3.b;
        synchronized (object) {
            if (!a3.E(a2)) {
                a3.H.add(new WeakReference<i_0>(a2));
            }
        }
        ub_1 ub_12 = a3;
        a2.E(ub_12.D, ub_12.j, a3.A);
    }

    public static /* synthetic */ ub_1 E() {
        return new ub_1("ABORT", "ABORT");
    }

    static {
        M = "ABORT";
        C = "ABORT";
    }
}

