/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.Tf;
import ttw.tradefinder.bE;
import ttw.tradefinder.be_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.ne_0;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.qe_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Ve
 */
public class ve_0
extends qe_0 {
    private boolean a;
    private double h;
    private long H;
    private double D;
    private bE A;
    private long C;
    private int M;
    private final Object b;
    private int c;

    public /* synthetic */ void E(long a2) {
        ve_0 ve_02;
        ve_0 a3;
        if (a2 == 0L) {
            Object object = a3.b;
            synchronized (object) {
                a3.A.E();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : var3_3
                ve_02 = a3;
            }
        } else {
            ve_02 = a3;
        }
        ve_02.a = false;
        ve_0 ve_03 = a3;
        ve_0 ve_04 = a3;
        ve_0 ve_05 = a3;
        ve_05.M = 0;
        ve_05.c = 0;
        ve_04.C = 0L;
        ve_04.D = 0.0;
        ve_03.h = 0.0;
        ve_03.H = a2;
    }

    public /* synthetic */ cc_0 E(ze_2 a2) {
        ve_0 a3;
        return Tf.E(a2, a3);
    }

    public /* synthetic */ double E(long a2) {
        ve_0 a3;
        double d2 = 0.0;
        Object object = a3.b;
        synchronized (object) {
            Iterator iterator = a2 = a3.A.tailMap(a2).values().iterator();
            while (iterator.hasNext()) {
                be_0 be_02 = (be_0)a2.next();
                d2 += be_02.c;
                iterator = a2;
            }
            return d2;
        }
    }

    public /* synthetic */ void E(long a2, int a3, double a4) {
        ve_0 a5;
        Object object = a5.b;
        synchronized (object) {
            a5.A.E(a2, a3, a4);
            return;
        }
    }

    public /* synthetic */ Map<String, String> E(ze_2 a2) {
        ve_0 a3;
        return Tf.E(a2, a3);
    }

    @Override
    public /* synthetic */ int E() {
        ve_0 a2;
        return a2.M;
    }

    public /* synthetic */ boolean E(long a2, ne_0 a3, double a4, int a5) {
        int n2;
        ve_0 a6;
        double d2 = 0.0;
        long l2 = 0L;
        int n3 = Integer.MAX_VALUE;
        int n4 = Integer.MAX_VALUE;
        int n5 = Integer.MIN_VALUE;
        boolean bl = false;
        Object object = a6.b;
        synchronized (object) {
            if (a6.A.isEmpty()) {
                return false;
            }
            ve_0 ve_02 = a6;
            ve_02.A.headMap(a2).clear();
            for (Map.Entry entry : ve_02.A.tailMap(Math.max(a6.H, a2)).entrySet()) {
                be_0 be_02 = (be_0)entry.getValue();
                d2 += be_02.c;
                int n6 = be_02.b;
                if (n6 > n4) {
                    n4 = n6;
                }
                if (n6 < n3) {
                    n3 = n6;
                    n4 = n6;
                    l2 = entry.getKey();
                    bl = false;
                }
                if (n6 <= n5) continue;
                n5 = n6;
                bl = true;
            }
        }
        int n7 = n2 = bl ? n5 - n3 : n3 - n5;
        if (a6.a) {
            if (n3 < a6.M) {
                ve_0 ve_03 = a6;
                a6.M = n3;
                ve_03.C = l2;
                ve_03.h = Math.max(d2, a6.h);
                a6.c = Math.min(n2, a6.c);
                a6.D = a3.E(a2);
            }
            if (d2 < 0.85 * a6.h || n4 > a6.M + 1) {
                return true;
            }
        } else if (d2 >= a4 && n2 <= -a5) {
            ve_0 ve_04 = a6;
            ve_0 ve_05 = a6;
            a6.a = true;
            ve_05.M = n3;
            ve_05.C = l2;
            ve_04.c = n2;
            ve_04.h = d2;
            a6.D = a3.E(a2);
        }
        return false;
    }

    public /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3) {
        ve_0 a4;
        return Tf.E(a2, a3, a4);
    }

    public /* synthetic */ String E(ze_2 a2) {
        ve_0 a3;
        return Tf.E(a2, a3);
    }

    @Override
    public /* synthetic */ int j() {
        ve_0 a2;
        return a2.c;
    }

    @Override
    public /* synthetic */ long E() {
        ve_0 a2;
        return a2.C;
    }

    @Override
    public /* synthetic */ double a() {
        ve_0 a2;
        return a2.h;
    }

    @Override
    public /* synthetic */ double E() {
        ve_0 a2;
        if (a2.D == 0.0) {
            return Double.NEGATIVE_INFINITY;
        }
        if (a2.h == 0.0) {
            return 0.0;
        }
        return a2.h / a2.D;
    }

    public /* synthetic */ ve_0() {
        ve_0 a2;
        ve_0 ve_02 = a2;
        ve_0 ve_03 = a2;
        ve_0 ve_04 = a2;
        ve_0 ve_05 = a2;
        ve_05.b = new Object();
        ve_05.A = new bE();
        ve_05.a = false;
        ve_04.M = 0;
        ve_04.c = 0;
        ve_03.C = 0L;
        ve_03.D = 0.0;
        ve_02.h = 0.0;
        ve_02.H = 0L;
    }

    @Override
    public /* synthetic */ double j() {
        ve_0 a2;
        return a2.D;
    }

    @Override
    public /* synthetic */ boolean E() {
        return true;
    }
}

