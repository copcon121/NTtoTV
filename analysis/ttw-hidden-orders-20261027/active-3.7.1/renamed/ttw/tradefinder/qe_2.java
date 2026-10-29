/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Ff;

/*
 * Renamed from ttw.tradefinder.Qe
 */
public class qe_2 {
    private int C;
    private long[] M;
    private final int b;
    private Ff[] c;

    public int j(long a2) {
        int n2;
        qe_2 a3;
        if (a3.C == 0) {
            return -1;
        }
        qe_2 qe_22 = a3;
        if (a2 > qe_22.M[qe_22.C - 1]) {
            return -1;
        }
        if (a2 < a3.M[0]) {
            return 0;
        }
        qe_2 qe_23 = a3;
        int n3 = n2 = qe_23.C / 2;
        int n4 = qe_23.C - 1;
        long l2 = a2;
        while (l2 != a3.M[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.M[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.M[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.M[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    public long long_E(int a2) {
        qe_2 a3;
        if (a2 >= a3.C) {
            return 0L;
        }
        return a3.M[a2];
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 1 << 3 ^ 2;
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ (2 << 2 ^ 1);
        int n5 = n3;
        int n6 = 1 << 3 ^ (2 ^ 5);
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

    public Ff ttw_tradefinder_Ff_E(int a2) {
        qe_2 a3;
        if (a2 >= a3.C) {
            return null;
        }
        return a3.c[a2];
    }

    public int E(long a2) {
        int n2;
        qe_2 a3;
        if (a3.C == 0) {
            return -1;
        }
        if (a2 < a3.M[0]) {
            return -1;
        }
        qe_2 qe_22 = a3;
        if (a2 > qe_22.M[qe_22.C - 1]) {
            return a3.C - 1;
        }
        qe_2 qe_23 = a3;
        int n3 = n2 = qe_23.C / 2;
        int n4 = qe_23.C - 1;
        long l2 = a2;
        while (l2 != a3.M[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.M[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.M[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.M[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, Ff a3) {
        qe_2 qe_22;
        qe_2 a4;
        qe_2 qe_23 = a4;
        if (qe_23.C == qe_23.M.length) {
            qe_2 qe_24 = a4;
            if (qe_24.b <= qe_24.M.length) return;
            qe_2 qe_25 = a4;
            qe_22 = qe_25;
            qe_25.void_j();
        } else {
            qe_22 = a4;
        }
        qe_22.M[a4.C] = a2;
        a4.c[a4.C++] = a3;
    }

    public void a() {
        int n2;
        qe_2 a2;
        qe_2 qe_22 = a2;
        if (qe_22.C >= qe_22.M.length) {
            return;
        }
        qe_2 qe_23 = a2;
        long[] lArray = new long[qe_23.C];
        Ff[] ffArray = new Ff[qe_23.C];
        int n3 = n2 = 0;
        while (n3 < a2.C) {
            int n4 = n2;
            lArray[n4] = a2.M[n4];
            int n5 = n2++;
            ffArray[n5] = a2.c[n5];
            n3 = n2;
        }
        a2.M = lArray;
        a2.c = ffArray;
    }

    public void void_j() {
        int n2;
        qe_2 a2;
        int n3 = Math.min(a2.M.length + a2.M.length / 2, a2.b);
        long[] lArray = new long[n3];
        Ff[] ffArray = new Ff[n3];
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            int n5 = n2;
            lArray[n5] = a2.M[n5];
            int n6 = n2++;
            ffArray[n6] = a2.c[n6];
            n4 = n2;
        }
        a2.M = lArray;
        a2.c = ffArray;
    }

    public qe_2(int a2) {
        a3(a2, Integer.MAX_VALUE);
        qe_2 a3;
    }

    public qe_2(int a2, int a3) {
        qe_2 a4;
        qe_2 qe_22 = a4;
        a4.C = 0;
        int n2 = a2;
        a4.b = Math.max(a3, n2);
        qe_22.M = new long[n2];
        qe_22.c = new Ff[a2];
    }

    public int int_j() {
        qe_2 a2;
        return a2.M.length;
    }

    public int int_E() {
        qe_2 a2;
        return a2.C;
    }

    public void void_E() {
        qe_2 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.C) {
            a2.c[n2++] = null;
            n3 = n2;
        }
        a2.C = 0;
    }
}

