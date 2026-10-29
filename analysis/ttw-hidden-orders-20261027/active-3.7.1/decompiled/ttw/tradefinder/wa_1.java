/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import ttw.tradefinder.Vb;
import ttw.tradefinder.b_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.i_0;
import ttw.tradefinder.k_0;
import ttw.tradefinder.qc_1;

/*
 * Renamed from ttw.tradefinder.wA
 */
public class wa_1
implements i_0 {
    private final List<WeakReference<b_0>> h;
    private final Timer H;
    private final List<WeakReference<k_0>> D;
    private Object A;
    private TimerTask C;
    private final Map<cd, Boolean> M;
    private cd b;
    private final Map<cd, Integer> c;

    public /* synthetic */ void d() {
        wa_1 a2;
        Object object = a2.A;
        synchronized (object) {
            if (a2.C != null) {
                a2.C.cancel();
            }
            a2.C = new Vb(a2);
        }
        a2.H.schedule(a2.C, Duration.ofSeconds(5L).toMillis());
        a2.b = cd.b;
        a2.M.clear();
    }

    public /* synthetic */ void E(qc_1 a2) {
        wa_1 a3;
        Iterator<cd> iterator;
        Iterator<cd> iterator2 = iterator = a3.c.keySet().iterator();
        while (iterator2.hasNext()) {
            cd cd2 = iterator.next();
            iterator2 = iterator;
            a2.E(cd2, a3);
        }
    }

    public /* synthetic */ void a() {
        wa_1 a2;
        Object object = a2.A;
        synchronized (object) {
            if (a2.C != null) {
                a2.C.cancel();
            }
            a2.C = null;
            return;
        }
    }

    public /* synthetic */ void E(k_0 a2) {
        wa_1 a3;
        a3.D.add(new WeakReference<k_0>(a2));
    }

    public /* synthetic */ List<cd> E() {
        wa_1 a2;
        ArrayList<cd> arrayList = new ArrayList<cd>();
        Iterator<Map.Entry<cd, Boolean>> iterator = a2.M.entrySet().iterator();
        block0: while (true) {
            Iterator<Map.Entry<cd, Boolean>> iterator2 = iterator;
            while (iterator2.hasNext()) {
                Map.Entry<cd, Boolean> entry = iterator.next();
                if (!entry.getValue().booleanValue()) continue block0;
                arrayList.add(entry.getKey());
                iterator2 = iterator;
            }
            break;
        }
        return arrayList;
    }

    public /* synthetic */ cd E() {
        wa_1 a2;
        return a2.b;
    }

    private /* synthetic */ void E(cd a2, boolean a32) {
        wa_1 a4;
        if (a2 == a4.b && !a32) {
            return;
        }
        a4.b = a2;
        Object object = a2 = a4.D.iterator();
        while (object.hasNext()) {
            WeakReference a32 = (WeakReference)a2.next();
            if (a32.get() == null) {
                Object object2 = a2;
                object = object2;
                object2.remove();
                continue;
            }
            ((k_0)a32.get()).E(a4.b);
            object = a2;
        }
    }

    @Override
    public /* synthetic */ void E(cd a22, boolean a32, boolean a42) {
        wa_1 a5;
        if (a22 == cd.b || !a42) {
            return;
        }
        if (!a5.c.containsKey((Object)a22)) {
            return;
        }
        if (a5.M.containsKey((Object)a22) && a5.M.get((Object)a22) == a32) {
            return;
        }
        a5.M.put(a22, a32);
        wa_1 wa_12 = a5;
        wa_12.j();
        int a22 = Integer.MIN_VALUE;
        cd a32 = cd.b;
        Iterator<Map.Entry<cd, Boolean>> a42 = wa_12.M.entrySet().iterator();
        while (a42.hasNext()) {
            Map.Entry<cd, Boolean> entry = a42.next();
            if (!entry.getValue().booleanValue() || a5.c.get((Object)entry.getKey()) <= a22) continue;
            a22 = a5.c.get((Object)entry.getKey());
            a32 = entry.getKey();
        }
        if (a5.M.size() == a5.c.size()) {
            wa_1 wa_13 = a5;
            wa_13.a();
            wa_13.E(a32, true);
            return;
        }
        a5.E(a32, false);
    }

    public /* synthetic */ void E(b_0 a2) {
        wa_1 a3;
        a3.h.add(new WeakReference<b_0>(a2));
    }

    public /* synthetic */ wa_1(Map<cd, Integer> a2) {
        wa_1 a3;
        wa_1 wa_12 = a3;
        a3.A = new Object();
        a3.D = new ArrayList<WeakReference<k_0>>();
        a3.h = new ArrayList<WeakReference<b_0>>();
        wa_12.M = new HashMap<cd, Boolean>();
        wa_12.H = new Timer();
        wa_12.C = null;
        a3.b = cd.b;
        a3.c = a2;
        if (!a3.c.containsKey((Object)cd.H)) {
            a3.c.put(cd.H, Integer.MAX_VALUE);
        }
        a3.d();
    }

    public /* synthetic */ void j() {
        Iterator<WeakReference<b_0>> iterator;
        wa_1 a2;
        wa_1 wa_12 = a2;
        List<cd> list = wa_12.E();
        Iterator<WeakReference<b_0>> iterator2 = iterator = wa_12.h.iterator();
        while (iterator2.hasNext()) {
            WeakReference<b_0> weakReference = iterator.next();
            if (weakReference.get() == null) {
                Iterator<WeakReference<b_0>> iterator3 = iterator;
                iterator2 = iterator3;
                iterator3.remove();
                continue;
            }
            ((b_0)weakReference.get()).E(list);
            iterator2 = iterator;
        }
    }

    public /* synthetic */ void E() {
        wa_1 a2;
        wa_1 wa_12 = a2;
        wa_12.H.cancel();
        wa_12.D.clear();
        wa_12.h.clear();
    }
}

