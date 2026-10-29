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
import ttw.tradefinder.qd_2;
import ttw.tradefinder.qe_0;
import ttw.tradefinder.ve_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.NE
 */
public class ne_0
extends qe_0 {
    private int a;
    private int h;
    private double H;
    private long D;
    private final Object A;
    private long C;
    private bE M;
    private boolean b;
    private double c;

    @Override
    public /* synthetic */ int j() {
        ne_0 a2;
        return a2.a;
    }

    public /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3) {
        ne_0 a4;
        return Tf.E(a2, a3, a4);
    }

    public /* synthetic */ Map<String, String> E(ze_2 a2) {
        ne_0 a3;
        return Tf.E(a2, a3);
    }

    public /* synthetic */ void E(long a2, int a3, double a4) {
        ne_0 a5;
        Object object = a5.A;
        synchronized (object) {
            a5.M.E(a2, a3, a4);
            return;
        }
    }

    @Override
    public /* synthetic */ double j() {
        ne_0 a2;
        return a2.H;
    }

    public /* synthetic */ double E(long a2) {
        ne_0 a3;
        double d2 = 0.0;
        Object object = a3.A;
        synchronized (object) {
            Iterator iterator = a2 = a3.M.tailMap(a2).values().iterator();
            while (iterator.hasNext()) {
                be_0 be_02 = (be_0)a2.next();
                d2 += be_02.c;
                iterator = a2;
            }
            return d2;
        }
    }

    public /* synthetic */ ne_0() {
        ne_0 a2;
        ne_0 ne_02 = a2;
        ne_0 ne_03 = a2;
        ne_0 ne_04 = a2;
        ne_0 ne_05 = a2;
        ne_05.A = new Object();
        ne_05.M = new bE();
        ne_05.b = false;
        ne_04.h = 0;
        ne_04.a = 0;
        ne_03.D = 0L;
        ne_03.H = 0.0;
        ne_02.c = 0.0;
        ne_02.C = 0L;
    }

    @Override
    public /* synthetic */ long E() {
        ne_0 a2;
        return a2.D;
    }

    public /* synthetic */ boolean E(long a2, ve_0 a3, double a4, int a5) {
        int n2;
        ne_0 a6;
        double d2 = 0.0;
        long l2 = 0L;
        int n3 = Integer.MAX_VALUE;
        int n4 = Integer.MAX_VALUE;
        int n5 = Integer.MIN_VALUE;
        boolean bl = false;
        Object object = a6.A;
        synchronized (object) {
            if (a6.M.isEmpty()) {
                return false;
            }
            ne_0 ne_02 = a6;
            ne_02.M.headMap(a2).clear();
            for (Map.Entry entry : ne_02.M.tailMap(Math.max(a6.C, a2)).entrySet()) {
                be_0 be_02 = (be_0)entry.getValue();
                d2 += be_02.c;
                int n6 = be_02.b;
                if (n6 < n4) {
                    n4 = n6;
                }
                if (n6 < n3) {
                    n3 = n6;
                    bl = false;
                }
                if (n6 <= n5) continue;
                n5 = n6;
                n4 = n6;
                l2 = entry.getKey();
                bl = true;
            }
        }
        int n7 = n2 = bl ? n5 - n3 : n3 - n5;
        if (a6.b) {
            if (n5 > a6.h) {
                ne_0 ne_03 = a6;
                ne_0 ne_04 = a6;
                ne_04.h = n5;
                ne_04.D = l2;
                ne_03.a = Math.max(n2, a6.a);
                ne_03.H = Math.max(d2, a6.H);
                a6.c = a3.E(a2);
            }
            if (d2 < 0.85 * a6.H || n4 < a6.h - 1) {
                return true;
            }
        } else if (d2 >= a4 && n2 >= a5) {
            ne_0 ne_05 = a6;
            ne_0 ne_06 = a6;
            a6.b = true;
            ne_06.h = n5;
            ne_06.D = l2;
            ne_05.a = n2;
            ne_05.H = d2;
            a6.c = a3.E(a2);
        }
        return false;
    }

    public /* synthetic */ String E(ze_2 a2) {
        ne_0 a3;
        return Tf.E(a2, a3);
    }

    @Override
    public /* synthetic */ int E() {
        ne_0 a2;
        return a2.h;
    }

    @Override
    public /* synthetic */ double a() {
        ne_0 a2;
        return a2.c;
    }

    public /* synthetic */ cc_0 E(ze_2 a2) {
        ne_0 a3;
        return Tf.E(a2, a3);
    }

    @Override
    public /* synthetic */ boolean E() {
        return false;
    }

    public /* synthetic */ void E(long a2) {
        ne_0 ne_02;
        ne_0 a3;
        if (a2 == 0L) {
            Object object = a3.A;
            synchronized (object) {
                a3.M.E();
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl6 : MonitorExitStatement: MONITOREXIT : var3_3
                ne_02 = a3;
            }
        } else {
            ne_02 = a3;
        }
        ne_02.b = false;
        ne_0 ne_03 = a3;
        ne_0 ne_04 = a3;
        ne_0 ne_05 = a3;
        ne_05.h = 0;
        ne_05.a = 0;
        ne_04.D = 0L;
        ne_04.H = 0.0;
        ne_03.c = 0.0;
        ne_03.C = a2;
    }

    @Override
    public /* synthetic */ double E() {
        ne_0 a2;
        if (a2.c == 0.0) {
            return Double.POSITIVE_INFINITY;
        }
        if (a2.H == 0.0) {
            return 0.0;
        }
        return a2.H / a2.c;
    }
}

