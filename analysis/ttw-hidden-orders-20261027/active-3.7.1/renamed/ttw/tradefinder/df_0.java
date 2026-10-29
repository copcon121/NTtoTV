/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import ttw.tradefinder.ia;
import ttw.tradefinder.ja_2;
import ttw.tradefinder.n_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.dF
 */
public class df_0<T extends wa_2<TS>, TS extends ia>
implements ja_2 {
    public T M;
    public Object b;
    private List<WeakReference<n_0>> c;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     * Converted monitor instructions to comments
     * Lifted jumps to return sites
     */
    public void j(n_0 a2) {
        Object object;
        WeakReference<n_0> weakReference;
        df_0 a3;
        Object object2 = a3.b;
        // MONITORENTER : object2
        Iterator<WeakReference<n_0>> iterator = a3.c.iterator();
        block3: do {
            Iterator<WeakReference<n_0>> iterator2 = iterator;
            while (true) {
                if (!iterator2.hasNext()) {
                    object = object2;
                    // MONITOREXIT : object
                    return;
                }
                weakReference = iterator.next();
                if (weakReference.get() != null) continue block3;
                Iterator<WeakReference<n_0>> iterator3 = iterator;
                iterator2 = iterator3;
                iterator3.remove();
            }
        } while (weakReference.get() != a2);
        object = object2;
        weakReference.clear();
        iterator.remove();
    }

    public void E(pf_0 a2) {
        df_0 a3;
        Object object = new ArrayList<WeakReference<n_0>>();
        Iterator iterator = a3.b;
        synchronized (iterator) {
            object.addAll(a3.c);
        }
        Iterator iterator2 = iterator = object.iterator();
        while (iterator2.hasNext()) {
            object = (WeakReference)iterator.next();
            if (((Reference)object).get() == null) {
                Iterator iterator3 = iterator;
                iterator2 = iterator3;
                iterator3.remove();
                continue;
            }
            ((n_0)((Reference)object).get()).E(a2);
            iterator2 = iterator;
        }
    }

    @Override
    public void E() {
        df_0 a2;
        Object object = a2.b;
        synchronized (object) {
            Iterator<WeakReference<n_0>> iterator;
            Iterator<WeakReference<n_0>> iterator2 = iterator = a2.c.iterator();
            while (iterator2.hasNext()) {
                iterator.next().clear();
                iterator2 = iterator;
            }
            a2.c.clear();
            return;
        }
    }

    public void E(n_0 a2) {
        df_0 a3;
        Object object = a3.b;
        synchronized (object) {
            a3.c.add(new WeakReference<n_0>(a2));
            return;
        }
    }

    public df_0(T a2) {
        df_0 a3;
        df_0 df_02 = a3;
        df_02.b = new Object();
        df_02.c = new ArrayList<WeakReference<n_0>>();
        df_02.M = a2;
    }
}

