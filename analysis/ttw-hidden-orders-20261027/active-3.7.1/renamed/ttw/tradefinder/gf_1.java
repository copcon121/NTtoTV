/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.a_0;

/*
 * Renamed from ttw.tradefinder.gF
 */
public class gf_1 {
    private final int A;
    private a_0[] C;
    private final boolean M;
    private long[] b;
    private int c;

    public void A() {
        int n2;
        gf_1 a2;
        gf_1 gf_12 = a2;
        long[] lArray = new long[gf_12.c];
        a_0[] a_0Array = new a_0[gf_12.c];
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            int n4 = n2;
            lArray[n4] = a2.b[n4];
            int n5 = n2++;
            a_0Array[n5] = a2.C[n5];
            n3 = n2;
        }
        a2.b = lArray;
        a2.C = a_0Array;
    }

    public void d() {
        int n2;
        gf_1 a2;
        gf_1 gf_12 = a2;
        long[] lArray = new long[a2.c - gf_12.c / 4 + 1];
        a_0[] a_0Array = new a_0[gf_12.c - a2.c / 4 + 1];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.b[n2];
                a_0Array[n3++] = a2.C[n2];
            }
            n4 = ++n2;
        }
        gf_1 gf_13 = a2;
        gf_13.b = lArray;
        gf_13.C = a_0Array;
        a2.c = n3;
    }

    public void a() {
        int n2;
        gf_1 a2;
        long[] lArray = new long[a2.b.length];
        a_0[] a_0Array = new a_0[a2.b.length];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.b[n2];
                a_0Array[n3++] = a2.C[n2];
            }
            n4 = ++n2;
        }
        gf_1 gf_12 = a2;
        gf_12.b = lArray;
        gf_12.C = a_0Array;
        a2.c = n3;
    }

    public int j(long a2) {
        int n2;
        gf_1 a3;
        if (a3.c == 0) {
            return -1;
        }
        if (a2 < a3.b[0]) {
            return -1;
        }
        gf_1 gf_12 = a3;
        if (a2 > gf_12.b[gf_12.c - 1]) {
            return a3.c - 1;
        }
        gf_1 gf_13 = a3;
        int n3 = n2 = gf_13.c / 2;
        int n4 = gf_13.c - 1;
        long l2 = a2;
        while (l2 != a3.b[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.b[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.b[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.b[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    public int int_j() {
        gf_1 a2;
        return a2.b.length;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, a_0 a3) {
        gf_1 gf_12;
        gf_1 a4;
        gf_1 gf_13 = a4;
        if (gf_13.c == gf_13.b.length) {
            gf_1 gf_14 = a4;
            if (gf_14.A > gf_14.b.length) {
                gf_1 gf_15 = a4;
                gf_12 = gf_15;
                gf_15.void_E();
            } else {
                if (!a4.M) return;
                gf_1 gf_16 = a4;
                gf_12 = gf_16;
                gf_16.a();
            }
        } else {
            gf_12 = a4;
        }
        gf_12.b[a4.c] = a2;
        a4.C[a4.c++] = a3;
    }

    public void void_j() {
        gf_1 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            a2.C[n2++] = null;
            n3 = n2;
        }
        a2.c = 0;
    }

    public gf_1(int a2, int a3, boolean a4) {
        gf_1 a5;
        gf_1 gf_12 = a5;
        gf_1 gf_13 = a5;
        gf_13.c = 0;
        gf_13.M = a4;
        int n2 = a2;
        gf_13.A = Math.max(a3, n2);
        gf_12.b = new long[n2];
        gf_12.C = new a_0[a2];
    }

    public a_0 ttw_tradefinder_a_0_E(int a2) {
        gf_1 a3;
        if (a2 >= a3.c) {
            return null;
        }
        return a3.C[a2];
    }

    public void void_E() {
        int n2;
        gf_1 a2;
        int n3 = Math.min(a2.b.length + a2.b.length / 2, a2.A);
        long[] lArray = new long[n3];
        a_0[] a_0Array = new a_0[n3];
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            int n5 = n2;
            lArray[n5] = a2.b[n5];
            int n6 = n2++;
            a_0Array[n6] = a2.C[n6];
            n4 = n2;
        }
        a2.b = lArray;
        a2.C = a_0Array;
    }

    public int int_E() {
        gf_1 a2;
        return a2.c;
    }

    public int E(long a2) {
        int n2;
        gf_1 a3;
        if (a3.c == 0) {
            return -1;
        }
        gf_1 gf_12 = a3;
        if (a2 > gf_12.b[gf_12.c - 1]) {
            return -1;
        }
        if (a2 < a3.b[0]) {
            return 0;
        }
        gf_1 gf_13 = a3;
        int n3 = n2 = gf_13.c / 2;
        int n4 = gf_13.c - 1;
        long l2 = a2;
        while (l2 != a3.b[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.b[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.b[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.b[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    public long long_E(int a2) {
        gf_1 a3;
        if (a2 >= a3.c) {
            return 0L;
        }
        return a3.b[a2];
    }

    public gf_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        gf_1 a3;
    }
}

