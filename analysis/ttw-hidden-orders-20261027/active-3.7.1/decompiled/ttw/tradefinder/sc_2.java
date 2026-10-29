/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener
 *  velox.api.layer1.layers.strategies.interfaces.InvalidateInterface
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable$Marker
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.function.Consumer;
import ttw.tradefinder.a_0;
import ttw.tradefinder.f_0;
import ttw.tradefinder.gf_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.u_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener;
import velox.api.layer1.layers.strategies.interfaces.InvalidateInterface;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.sC
 */
public abstract class sc_2
extends xb_2
implements u_0 {
    private Boolean a;
    private gf_1 h;
    private static int H = 60000;
    private final boolean D;
    private InvalidateInterface A;
    private Consumer<Object> C;
    private long M;
    private boolean b;
    private final Object c;

    public void a() {
        sc_2 a2;
        a2.b = true;
        a2.E(false);
    }

    public sc_2(f_0 a2, ze_2 a3, s_0 a4) {
        sc_2 a5;
        sc_2 sc_22 = a5;
        sc_2 sc_23 = a5;
        sc_2 sc_24 = a5;
        super(a2, a3, a4);
        a5.c = new Object();
        a5.h = new gf_1(H);
        sc_24.C = null;
        sc_24.A = null;
        sc_24.a = Boolean.FALSE;
        sc_23.M = 0L;
        sc_23.b = false;
        sc_22.D = a2.j();
        sc_22.b = false;
    }

    @Override
    public void E(long a22, long a3, int a4, CalculatedResultListener a5) {
        sc_2 a6;
        if (!a6.a.booleanValue()) {
            a5.setCompleted();
            return;
        }
        long l2 = a22 + (long)a4 * a3 + 1L;
        int n2 = 0;
        if (a22 >= l2) {
            a5.setCompleted();
            return;
        }
        a6.M = 0L;
        long l3 = a22;
        ArrayList<OnlineCalculatable.Marker> arrayList = new ArrayList<OnlineCalculatable.Marker>();
        gf_1 gf_12 = a6.h;
        synchronized (gf_12) {
            long l4;
            int a22 = a6.h.E(a22);
            if (a22 == -1) {
                a5.setCompleted();
                return;
            }
            int n3 = a22 = a22;
            while (n3 < a6.h.E() && !a5.isCancelled() && (l4 = a6.h.E(a22)) <= l2) {
                sc_2 sc_22 = a6;
                a6.M = l4;
                while (sc_22.M > l3) {
                    ++n2;
                    l3 += a3;
                    a5.provideResponse(arrayList.size() > 0 ? arrayList : null);
                    arrayList = new ArrayList();
                    sc_22 = a6;
                }
                sc_2 sc_23 = a6;
                arrayList.add(sc_23.E(sc_23.h.E(a22++)));
                n3 = a22;
            }
            ++n2;
            a5.provideResponse(arrayList.size() > 0 ? arrayList : null);
        }
        if (a6.M == 0L) {
            a6.M = l2;
        }
        int n4 = n2;
        while (true) {
            ++n2;
            if (n4 >= a4) break;
            n4 = n2;
            a5.provideResponse(null);
        }
        a5.setCompleted();
    }

    @Override
    public void E(boolean a22) {
        sc_2 sc_22;
        sc_2 a3;
        if (a22) {
            gf_1 a22 = a3.h;
            synchronized (a22) {
                a3.h.j();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 5] lbl6 : MonitorExitStatement: MONITOREXIT : a
                sc_22 = a3;
            }
        } else {
            sc_22 = a3;
        }
        InvalidateInterface a22 = sc_22.E();
        if (a22 != null) {
            a22.invalidate();
        }
    }

    public void E(a_0 a2, long a3) {
        sc_2 a4;
        Consumer<Object> consumer = a4.h;
        synchronized (consumer) {
            a4.h.E(a3, a2);
        }
        if (!a4.D) {
            return;
        }
        if (!a4.b) {
            return;
        }
        if (!a4.a.booleanValue()) {
            return;
        }
        consumer = a4.E();
        if (consumer == null) {
            return;
        }
        consumer.accept(a4.E(a2));
    }

    public abstract OnlineCalculatable.Marker E(a_0 var1);

    @Override
    public void j() {
        sc_2 a2;
        sc_2 sc_22 = a2;
        super.j();
        sc_22.E(true);
    }

    @Override
    public void E(Consumer<Object> a2, InvalidateInterface a3) {
        sc_2 a4;
        Object object = a4.c;
        synchronized (object) {
            a4.C = a2;
            a4.A = a3;
            return;
        }
    }

    @Override
    public void E() {
        sc_2 a2;
        super.E();
        a2.M = 0L;
    }

    public void a(boolean a2) {
        sc_2 a3;
        if (a3.a == a2) {
            return;
        }
        boolean bl = a2;
        a3.a = bl;
        a3.j(bl);
    }

    @Override
    public boolean E() {
        sc_2 a2;
        return a2.a;
    }

    public InvalidateInterface E() {
        sc_2 a2;
        Object object = a2.c;
        synchronized (object) {
            return a2.A;
        }
    }

    @Override
    public void E(long a2) {
        sc_2 a3;
        if (!a3.a.booleanValue() || a3.D) {
            return;
        }
        Consumer<Object> consumer = a3.E();
        if (consumer == null) {
            return;
        }
        if (a3.M == 0L) {
            a3.M = a2 - 1L;
        }
        ArrayList<OnlineCalculatable.Marker> arrayList = new ArrayList<OnlineCalculatable.Marker>();
        if (a3.M >= a2) {
            return;
        }
        gf_1 gf_12 = a3.h;
        synchronized (gf_12) {
            long l2;
            sc_2 sc_22 = a3;
            int n2 = sc_22.h.E(sc_22.M + 1L);
            if (n2 == -1) {
                return;
            }
            int n3 = n2 = n2;
            while (n3 < a3.h.E() && (l2 = a3.h.E(n2)) <= a2) {
                sc_2 sc_23 = a3;
                sc_23.M = l2;
                arrayList.add(sc_23.E(sc_23.h.E(n2++)));
                n3 = n2;
            }
        }
        if (arrayList.size() > 0) {
            consumer.accept(arrayList);
        }
    }

    @Override
    public void j(long a2) {
        a.M = 0L;
    }

    public Consumer<Object> E() {
        sc_2 a2;
        Object object = a2.c;
        synchronized (object) {
            return a2.C;
        }
    }
}

