/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.K;
import ttw.tradefinder.bd_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.g_0;
import ttw.tradefinder.i_0;
import ttw.tradefinder.qc_1;

public class uc
implements K,
i_0 {
    private WeakReference<g_0> h;
    private boolean H;
    private boolean D;
    private final Map<cd, Boolean> A;
    private final Map<dd_1, Boolean> C;
    private final String M;
    private final qc_1 b;
    private final Map<cd, Boolean> c;

    @Override
    public /* synthetic */ String java_lang_String_E() {
        uc a2;
        return a2.M;
    }

    public /* synthetic */ uc(String a2, qc_1 a3, List<dd_1> a4, g_0 a5) {
        uc a6;
        uc uc2 = a6;
        uc uc3 = a6;
        a6.c = new HashMap<cd, Boolean>();
        uc3.A = new HashMap<cd, Boolean>();
        uc3.C = new HashMap<dd_1, Boolean>();
        uc3.D = false;
        uc2.H = false;
        uc2.M = a2;
        a6.h = new WeakReference<g_0>(a5);
        a6.b = a3;
        a6.c.put(cd.H, Boolean.FALSE);
        a6.A.put(cd.H, Boolean.FALSE);
        a2 = a4.iterator();
        Object object = a2;
        while (object.hasNext()) {
            a3 = (dd_1)((Object)a2.next());
            object = a2;
            a6.C.put((dd_1)((Object)a3), Boolean.FALSE);
        }
    }

    @Override
    public /* synthetic */ List<cd> E(dd_1 a2) {
        uc a3;
        ArrayList<cd> arrayList = new ArrayList<cd>();
        for (cd cd2 : a3.c.keySet()) {
            if (cd2 == cd.H || !bd_2.E(a2, cd2) || !a3.C.containsKey((Object)a2)) continue;
            arrayList.add(cd2);
        }
        return arrayList;
    }

    private /* synthetic */ boolean d() {
        uc a2;
        Iterator<Boolean> iterator = a2.A.values().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().booleanValue()) continue;
            return false;
        }
        return true;
    }

    private /* synthetic */ void void_j() {
        uc a2;
        Iterator<Map.Entry<dd_1, Boolean>> iterator;
        Iterator<Map.Entry<dd_1, Boolean>> iterator2 = iterator = a2.C.entrySet().iterator();
        while (iterator2.hasNext()) {
            Map.Entry<dd_1, Boolean> entry = iterator.next();
            entry.setValue(a2.j(entry.getKey()));
            iterator2 = iterator;
        }
    }

    private /* synthetic */ boolean a() {
        uc a2;
        Iterator<Boolean> iterator = a2.c.values().iterator();
        while (iterator.hasNext()) {
            if (!iterator.next().booleanValue()) continue;
            return true;
        }
        return false;
    }

    @Override
    public /* synthetic */ boolean boolean_j() {
        uc a2;
        return a2.D;
    }

    @Override
    public /* synthetic */ boolean boolean_E() {
        uc a2;
        return a2.H;
    }

    @Override
    public /* synthetic */ void E(cd a2, boolean a3, boolean a4) {
        uc a5;
        if (!a5.c.containsKey((Object)a2)) {
            return;
        }
        a5.c.put(a2, a3);
        a5.A.put(a2, a4);
        uc uc2 = a5;
        uc2.void_j();
        uc2.E(uc2.a(), a5.d());
    }

    private /* synthetic */ void E(boolean a2, boolean a3) {
        uc a4;
        if (a4.D == a2 && a4.H == a3) {
            return;
        }
        uc uc2 = a4;
        uc2.D = a2;
        uc2.H = a3;
        if (a4.h.get() != null) {
            uc uc3 = a4;
            ((g_0)a4.h.get()).E(uc3, uc3.D, a4.H);
        }
    }

    public /* synthetic */ void E(List<cd> a2) {
        uc a3;
        cd cd2;
        a2 = a2.iterator();
        block0: while (true) {
            Iterator<cd> iterator = a2;
            while (iterator.hasNext()) {
                cd2 = (cd)((Object)a2.next());
                if (a3.c.containsKey((Object)cd2)) continue block0;
                iterator = a2;
                a3.c.put(cd2, Boolean.FALSE);
                a3.A.put(cd2, Boolean.FALSE);
            }
            break;
        }
        Iterator<cd> iterator = a2 = a3.c.keySet().iterator();
        while (iterator.hasNext()) {
            cd2 = a2.next();
            iterator = a2;
            a3.b.E(cd2, a3);
        }
    }

    @Override
    public /* synthetic */ boolean E(dd_1 a2) {
        uc a3;
        if (a2 == dd_1.M) {
            return a3.D;
        }
        if (!a3.C.containsKey((Object)a2)) {
            return false;
        }
        return a3.C.get((Object)a2);
    }

    @Override
    public /* synthetic */ void void_E() {
        uc a2;
        uc uc2 = a2;
        a2.b.E(uc2);
        uc2.h.clear();
    }

    private /* synthetic */ boolean j(dd_1 a2) {
        uc a3;
        for (Map.Entry<cd, Boolean> entry : a3.c.entrySet()) {
            if (!entry.getValue().booleanValue() || !bd_2.E(a2, entry.getKey())) continue;
            return true;
        }
        return false;
    }
}

