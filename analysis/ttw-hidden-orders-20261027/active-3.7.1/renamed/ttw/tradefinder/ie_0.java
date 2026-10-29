/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import ttw.tradefinder.Oe;
import ttw.tradefinder.dg_0;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.lg_0;
import ttw.tradefinder.t_0;
import velox.api.layer1.data.TradeInfo;

/*
 * Renamed from ttw.tradefinder.IE
 */
public class ie_0 {
    private Map<String, jf_1> A;
    private final t_0 C;
    private Map<String, lg_0> M;
    private Object b;
    private lg_0 c;

    public /* synthetic */ void E(long a322, String a2, int a4, int a5, boolean a6) {
        ie_0 a7;
        Object object = a7.b;
        synchronized (object) {
            jf_1 jf_12;
            long a322;
            ie_0 ie_02;
            jf_1 a322;
            if (a7.c != null && a7.c.M.equals(a2)) {
                a322 = new jf_1(dg_0.M, a7.c, a5, a4, a6, a322);
                ie_02 = a7;
            } else if (a7.M.containsKey(a2)) {
                jf_12 = new jf_1(dg_0.M, a7.M.remove(a2), a5, a4, a6, a322);
                a322 = jf_12;
                ie_02 = a7;
            } else {
                jf_12 = new jf_1(dg_0.M, a2, a5, a4, a6, a322);
                a322 = jf_12;
                ie_02 = a7;
            }
            ie_02.A.put(a2, a322);
            a7.M.clear();
            return;
        }
    }

    private /* synthetic */ jf_1 j(String a2) {
        ie_0 a3;
        if (a2 == null || a2.isEmpty()) {
            return null;
        }
        Object object = a3.b;
        synchronized (object) {
            return a3.A.get(a2);
        }
    }

    private /* synthetic */ boolean E(String a2, long a3, int a4, int a5, boolean a6) {
        ie_0 a7;
        if ((a2 = a7.j((String)a2)) == null) {
            return false;
        }
        if ((a5 = ((jf_1)a2).E(a3, a5, a4, a6)) != 0) {
            a7.C.E(new jf_0(dg_0.M, a3, a5, a4, (boolean)((jf_1)a2).M), (jf_1)a2);
        }
        return true;
    }

    private /* synthetic */ jf_1 E(String a2) {
        ie_0 a3;
        if (a2 == null || a2.isEmpty()) {
            return null;
        }
        Object object = a3.b;
        synchronized (object) {
            return a3.A.remove(a2);
        }
    }

    public /* synthetic */ void E(long a2, String a3, int a4, int a5) {
        ie_0 a6;
        if ((a3 = a6.j((String)a3)) == null) {
            return;
        }
        Object object = a3;
        ((jf_1)object).E(a2, a5, a4);
        if (!((Oe)object).boolean_E()) {
            return;
        }
        a6.C.E((jf_1)a3);
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 4 << 1;
        int cfr_ignored_0 = 4 << 3 ^ 4;
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 1;
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }

    public /* synthetic */ void E() {
        ie_0 a2;
        Object object = a2.b;
        synchronized (object) {
            ie_0 ie_02 = a2;
            ie_02.A.clear();
            ie_02.M.clear();
            a2.c = null;
            return;
        }
    }

    public /* synthetic */ ie_0(t_0 a2) {
        ie_0 a3;
        ie_0 ie_02 = a3;
        ie_02.b = new Object();
        ie_02.A = new HashMap<String, jf_1>();
        ie_02.c = null;
        a3.M = new HashMap<String, lg_0>();
        a3.C = a2;
        a3.E();
    }

    private /* synthetic */ lg_0 ttw_tradefinder_lg_0_E(long a2, int a3, int a4, TradeInfo a5) {
        ie_0 a6;
        Object object = a6.b;
        synchronized (object) {
            lg_0 lg_02 = a6.M.remove(a5.aggressorOrderId);
            if (lg_02 != null) {
                lg_0 lg_03 = lg_02;
                lg_03.j(a2, a4, a3);
                return lg_03;
            }
            return new lg_0(a5.aggressorOrderId, a4, a3, !a5.isBidAggressor, false, a2);
        }
    }

    public /* synthetic */ List<jf_1> E(int a2) {
        ie_0 a3;
        ArrayList<jf_1> arrayList = new ArrayList<jf_1>();
        Object object = a3.b;
        synchronized (object) {
            for (jf_1 jf_12 : a3.A.values()) {
                if (jf_12.a < a2 || !jf_12.boolean_E()) continue;
                arrayList.add(jf_12);
            }
            return arrayList;
        }
    }

    public /* synthetic */ void void_E(long a2, int a3, int a4, TradeInfo a5) {
        ie_0 a6;
        if (a4 > 0) {
            a6.E(a5.passiveOrderId, a2, a3, a4, false);
            a6.E(a5.aggressorOrderId, a2, a3, a4, true);
        }
        if (a5.isExecutionStart || a5.isExecutionEnd) {
            if (a5.isExecutionEnd && a6.c != null) {
                Object object = a6.b;
                synchronized (object) {
                    ie_0 ie_02 = a6;
                    ie_02.M.put(ie_02.c.M, a6.c);
                }
                a6.c = null;
            }
            if (!a5.isExecutionStart || a5.aggressorOrderId == null) {
                return;
            }
            a6.c = a6.ttw_tradefinder_lg_0_E(a2, a3, a4, a5);
            return;
        }
        if (a5.aggressorOrderId == null || a5.aggressorOrderId.isEmpty()) {
            return;
        }
        if (a6.c == null) {
            a6.c = a6.ttw_tradefinder_lg_0_E(a2, a3, a4, a5);
            return;
        }
        if (a6.c.M.equals(a5.aggressorOrderId)) {
            a6.c.j(a2, a4, a3);
            return;
        }
        Object object = a6.b;
        synchronized (object) {
            ie_0 ie_03 = a6;
            ie_03.M.put(ie_03.c.M, a6.c);
        }
        a6.c = a6.ttw_tradefinder_lg_0_E(a2, a3, a4, a5);
    }

    public /* synthetic */ void E(long a2, String a3) {
        ie_0 a4;
        if ((a3 = a4.E((String)a3)) == null) {
            return;
        }
        if (!((Oe)a3).boolean_E()) {
            return;
        }
        ((jf_1)a3).void_E(a2);
        a4.C.j((jf_1)a3);
    }
}

