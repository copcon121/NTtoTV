/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.dg_0;
import ttw.tradefinder.ee_0;
import ttw.tradefinder.jf_0;
import ttw.tradefinder.jf_1;
import ttw.tradefinder.t_0;

/*
 * Renamed from ttw.tradefinder.PE
 */
public class pe_1 {
    private int H;
    private int D;
    private int A;
    private final t_0 C;
    private final boolean M;
    private final ee_0 b;
    private int c;

    public /* synthetic */ void E(long a2, int a3, int a4) {
        pe_1 a5;
        if (a5.H == 0 || a5.H != a3) {
            a5.H = a3;
            a4 = -((int)a5.b.E(a3));
            int n2 = a5.D = a4 != 0 ? a4 : Integer.MIN_VALUE;
            if (a5.A != 0) {
                a5.C.j(new jf_1(dg_0.b, a5.A, a3, a5.M, a2));
            }
            a5.A = 0;
            return;
        }
        if (a5.D == 0) {
            if (a4 <= a5.c) {
                return;
            }
            pe_1 pe_12 = a5;
            pe_12.A += a4;
            pe_12.C.E(new jf_0(dg_0.b, a2, a4, a3, a5.M), null);
            return;
        }
        pe_1 pe_13 = a5;
        pe_13.D += a4;
        if (pe_13.D > 0) {
            pe_1 pe_14 = a5;
            pe_14.A = pe_14.D;
            pe_14.D = 0;
            pe_14.C.E(new jf_0(dg_0.b, a2, a4, a3, a5.M), null);
        }
    }

    public /* synthetic */ pe_1(ee_0 a2, int a3, boolean a4, t_0 a5) {
        pe_1 a6;
        pe_1 pe_12 = a6;
        pe_1 pe_13 = a6;
        a6.H = 0;
        pe_13.D = Integer.MIN_VALUE;
        pe_13.A = 0;
        pe_12.b = a2;
        pe_12.C = a5;
        a6.M = a4;
        a6.E(a3);
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ (3 << 2 ^ 1);
        int cfr_ignored_0 = 3 ^ 5;
        int n5 = n3;
        int n6 = 5 << 4 ^ (3 << 2 ^ 3);
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

    public /* synthetic */ void E(int a2) {
        pe_1 a3;
        pe_1 pe_12 = a3;
        pe_1 pe_13 = a3;
        pe_13.D = Integer.MIN_VALUE;
        pe_13.A = 0;
        pe_12.H = 0;
        pe_12.c = a2;
    }
}

