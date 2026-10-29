/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.U;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.hc_0;
import ttw.tradefinder.lg_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.data.TradeInfo;

/*
 * Renamed from ttw.tradefinder.Kf
 */
public class kf_0 {
    private boolean a;
    private lg_0 h;
    private final Object H;
    private Map<String, lg_0> D;
    private lg_0 A;
    private final U C;
    private Map<String, lg_0> M;
    private String b;
    private final boolean c;

    public /* synthetic */ boolean boolean_E() {
        kf_0 a2;
        return a2.a;
    }

    private /* synthetic */ lg_0 j(long a22, int a3, int a4, TradeInfo a5) {
        kf_0 kf_02;
        kf_0 a6;
        boolean bl;
        String string = a5.aggressorOrderId;
        if (!a5.isBidAggressor) {
            bl = true;
            kf_02 = a6;
        } else {
            bl = false;
            kf_02 = a6;
        }
        lg_0 a22 = new lg_0(string, a4, a3, bl, kf_02.E(a5.aggressorOrderId), a22);
        if (!a22.C) {
            a6.b = a5.aggressorOrderId;
        }
        return a22;
    }

    public /* synthetic */ void void_E() {
        kf_0 a2;
        a2.A = null;
        a2.h = null;
        a2.M.clear();
        Object object = a2.H;
        synchronized (object) {
            a2.D.clear();
            return;
        }
    }

    private /* synthetic */ boolean E(String a2) {
        kf_0 a3;
        if (!a3.a) {
            return false;
        }
        if (a3.b.isEmpty()) {
            return false;
        }
        return a3.b.compareTo(a2) > 0;
    }

    public /* synthetic */ kf_0(U a2, ze_2 a3) {
        kf_0 a4;
        kf_0 kf_02 = a4;
        kf_0 kf_03 = a4;
        kf_0 kf_04 = a4;
        a4.H = new Object();
        a4.A = null;
        kf_04.h = null;
        kf_04.b = "";
        kf_03.D = new HashMap<String, lg_0>();
        kf_03.M = Collections.synchronizedMap(new HashMap());
        kf_03.C = a2;
        kf_02.c = a3.C;
        kf_02.a = a3.M.endsWith(hc_0.E("\u0004c\n")) || a3.M.endsWith(fg_0.E("0D9B8[9U"));
        a4.void_E();
    }

    public /* synthetic */ void E(long a22, String a3) {
        kf_0 a4;
        if (!a4.c) {
            return;
        }
        lg_0 a22 = a4.M.remove(a3);
        if (a22 != null) {
            a4.C.E(a22);
        }
    }

    public /* synthetic */ void void_E(long a2, int a3, int a4, TradeInfo a5) {
        kf_0 kf_02;
        kf_0 a6;
        if (a4 > 0) {
            if (a6.M.containsKey(a5.aggressorOrderId)) {
                a6.M.get(a5.aggressorOrderId).j(a2, a4, a3);
            }
            if (a6.M.containsKey(a5.passiveOrderId)) {
                a6.M.get(a5.passiveOrderId).E(a2, a4, a3);
            }
        }
        if (a5.isExecutionStart || a5.isExecutionEnd) {
            if (a5.isExecutionEnd) {
                a6.h = a6.A;
                a6.A = null;
            }
            if (!a5.isExecutionStart || a5.aggressorOrderId == null) {
                return;
            }
            a6.A = a6.ttw_tradefinder_lg_0_E(a2, a3, a4, a5);
            a6.h = null;
            return;
        }
        if (a5.aggressorOrderId == null || a5.aggressorOrderId.isEmpty()) {
            return;
        }
        if (a6.A == null) {
            a6.A = a6.ttw_tradefinder_lg_0_E(a2, a3, a4, a5);
            a6.h = null;
            return;
        }
        if (a6.A.M.equals(a5.aggressorOrderId)) {
            a6.A.j(a2, a4, a3);
            return;
        }
        kf_0 kf_03 = a6;
        kf_03.C.j(kf_03.A);
        if (kf_03.c) {
            Object object = a6.H;
            synchronized (object) {
                kf_0 kf_04 = a6;
                kf_04.D.put(kf_04.A.M, a6.A);
                // MONITOREXIT @DISABLED, blocks:[0, 1, 4] lbl33 : MonitorExitStatement: MONITOREXIT : var6_6
                kf_02 = a6;
            }
        } else {
            kf_0 kf_05 = a6;
            kf_02 = kf_05;
            kf_05.C.E(kf_05.A);
        }
        kf_02.A = kf_02.j(a2, a3, a4, a5);
    }

    public /* synthetic */ void E(long a22, String a3, int a42, int a5) {
        kf_0 a6;
        if (!a6.c) {
            return;
        }
        if (a6.h != null && a6.h.M.equals(a3)) {
            kf_0 kf_02 = a6;
            kf_02.M.put(kf_02.h.M, new lg_0(a6.h));
        }
        if (a6.A != null && a6.A.M.equals(a3)) {
            kf_0 kf_03 = a6;
            kf_03.M.put(kf_03.A.M, new lg_0(a6.A));
        }
        Object a22 = a6.H;
        synchronized (a22) {
            Iterator<lg_0> iterator;
            if (a6.D.size() == 0) {
                return;
            }
            Iterator<lg_0> iterator2 = iterator = a6.D.values().iterator();
            while (iterator2.hasNext()) {
                lg_0 a42 = iterator.next();
                if (a42.M.equals(a3)) {
                    iterator2 = iterator;
                    a6.M.put(a42.M, a42);
                    continue;
                }
                a6.C.E(a42);
                iterator2 = iterator;
            }
            a6.D.clear();
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private /* synthetic */ lg_0 ttw_tradefinder_lg_0_E(long a2, int a3, int a4, TradeInfo a5) {
        kf_0 kf_02;
        kf_0 a6;
        if (a6.h != null) {
            if (a6.h.M.equals(a5.aggressorOrderId)) {
                kf_0 kf_03 = a6;
                kf_03.h.j(a2, (int)a4, (int)a3);
                return kf_03.h;
            }
            kf_0 kf_04 = a6;
            kf_04.C.j(kf_04.h);
            if (kf_04.c) {
                Object object = a6.H;
                synchronized (object) {
                    kf_0 kf_05 = a6;
                    kf_05.D.put(kf_05.h.M, a6.h);
                }
                kf_02 = a6;
                return kf_02.j(a2, (int)a3, (int)a4, (TradeInfo)a5);
            }
            kf_0 kf_06 = a6;
            kf_06.C.E(kf_06.h);
        }
        kf_02 = a6;
        return kf_02.j(a2, (int)a3, (int)a4, (TradeInfo)a5);
    }
}

