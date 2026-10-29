/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.dg_0;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.t_0;

/*
 * Renamed from ttw.tradefinder.se
 */
public class se_0 {
    private int D;
    private final boolean A;
    private Map<String, jf_1> C;
    private final t_0 M;
    private int b;
    private int c;

    public /* synthetic */ se_0(int a2, boolean a3, t_0 a4) {
        se_0 a5;
        se_0 se_02 = a5;
        a5.C = new HashMap<String, jf_1>();
        a5.b = 0;
        se_02.D = 0;
        se_02.M = a4;
        a5.A = a3;
        a5.E(a2);
    }

    public /* synthetic */ void E(long a2, int a3, int a4, String a5) {
        se_0 a6;
        if (a5 == null || a5.isEmpty()) {
            return;
        }
        if (a6.b == 0 || a6.b != a3) {
            a6.b = a3;
            if (a6.D != 0) {
                a6.M.j(new jf_1(dg_0.C, a6.D, a3, a6.A, a2));
            }
            a6.D = 0;
            a6.C.clear();
            return;
        }
        if (a6.C.containsKey(a5)) {
            se_0 se_02 = a6;
            se_02.D += a4;
            se_02.M.E(new jf_0(dg_0.C, a2, a4, a3, a6.A), null);
        }
    }

    public /* synthetic */ void E(long a2, String a3) {
        se_0 a4;
        a4.C.remove(a3);
    }

    public /* synthetic */ void E(long a2, String a3, int a4, int a5) {
        se_0 a6;
        if ((a3 = a6.C.get(a3)) == null) {
            return;
        }
        ((jf_1)a3).E(a2, a5, a4);
    }

    public /* synthetic */ void E(int a2) {
        se_0 a3;
        se_0 se_02 = a3;
        a3.D = 0;
        se_02.b = 0;
        se_02.c = a2;
    }

    public /* synthetic */ void E(long a2, String a3, int a4, int a5, boolean a6) {
        se_0 a7;
        if (a4 != a7.b) {
            return;
        }
        if (a6 != a7.A) {
            return;
        }
        if (a5 <= a7.c) {
            return;
        }
        a7.C.put(a3, new jf_1(dg_0.C, a3, a5, a4, a6, a2));
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 3 ^ (3 ^ 5);
        int cfr_ignored_0 = 2 ^ 5;
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 5 << 1;
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
}

