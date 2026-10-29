/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.jc_0;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class PF {
    private final boolean A;
    private jc_0[] C;
    private final int M;
    private long[] b;
    private int c;

    public PF(int a2, int a3, boolean a4) {
        PF a5;
        PF pF = a5;
        PF pF2 = a5;
        pF2.c = 0;
        pF2.A = a4;
        int n2 = a2;
        pF2.M = Math.max(a3, n2);
        pF.b = new long[n2];
        pF.C = new jc_0[a2];
    }

    public void d() {
        int n2;
        PF a2;
        int n3 = Math.max(a2.b.length, 9);
        long[] lArray = new long[n3];
        jc_0[] jc_0Array = new jc_0[n3];
        int n4 = 0;
        jc_0 jc_02 = null;
        jc_0 jc_03 = null;
        int n5 = n2 = 0;
        while (n5 < a2.c) {
            jc_0 jc_04 = a2.C[n2];
            if (n2 % 4 == 0 && n2 != 0) {
                if (jc_04.E()) {
                    if (jc_03 != null) {
                        jc_03.E(jc_04);
                    } else {
                        jc_03 = jc_04;
                    }
                } else if (jc_02 != null) {
                    jc_02.E(jc_04);
                } else {
                    jc_02 = jc_04;
                }
            } else {
                long[] lArray2;
                if (jc_03 != null && jc_04.E()) {
                    jc_04.E(jc_03);
                    jc_03 = null;
                    lArray2 = lArray;
                } else {
                    if (jc_02 != null && !jc_04.E()) {
                        jc_04.E(jc_02);
                        jc_02 = null;
                    }
                    lArray2 = lArray;
                }
                lArray2[n4] = a2.b[n2];
                jc_0Array[n4++] = jc_04;
            }
            n5 = ++n2;
        }
        if (jc_03 != null) {
            int n6 = n4;
            long l2 = lArray[n4 - 1] + 1L;
            ++n4;
            lArray[n6] = l2;
            jc_0Array[n6] = jc_03;
        }
        if (jc_02 != null) {
            int n7 = n4;
            long l3 = lArray[n4 - 1] + 1L;
            ++n4;
            lArray[n7] = l3;
            jc_0Array[n7] = jc_02;
        }
        PF pF = a2;
        pF.b = lArray;
        pF.C = jc_0Array;
        a2.c = n4;
    }

    public void a() {
        PF a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            a2.C[n2++] = null;
            n3 = n2;
        }
        a2.c = 0;
    }

    public int j(long a2) {
        int n2;
        PF a3;
        if (a3.c == 0) {
            return -1;
        }
        PF pF = a3;
        if (a2 > pF.b[pF.c - 1]) {
            return -1;
        }
        if (a2 < a3.b[0]) {
            return 0;
        }
        PF pF2 = a3;
        int n3 = n2 = pF2.c / 2;
        int n4 = pF2.c - 1;
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

    public void j() {
        int n2;
        PF a2;
        PF pF = a2;
        long[] lArray = new long[pF.c];
        jc_0[] jc_0Array = new jc_0[pF.c];
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            int n4 = n2;
            lArray[n4] = a2.b[n4];
            int n5 = n2++;
            jc_0Array[n5] = a2.C[n5];
            n3 = n2;
        }
        a2.b = lArray;
        a2.C = jc_0Array;
    }

    public int j() {
        PF a2;
        return a2.b.length;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, jc_0 a3) {
        PF pF;
        PF a4;
        PF pF2 = a4;
        if (pF2.c == pF2.b.length) {
            PF pF3 = a4;
            if (pF3.M > pF3.b.length) {
                PF pF4 = a4;
                pF = pF4;
                pF4.E();
            } else {
                if (!a4.A) return;
                PF pF5 = a4;
                pF = pF5;
                pF5.d();
            }
        } else {
            pF = a4;
        }
        pF.b[a4.c] = a2;
        a4.C[a4.c++] = a3;
    }

    public int E(long a2) {
        int n2;
        PF a3;
        if (a3.c == 0) {
            return -1;
        }
        if (a2 < a3.b[0]) {
            return -1;
        }
        PF pF = a3;
        if (a2 > pF.b[pF.c - 1]) {
            return a3.c - 1;
        }
        PF pF2 = a3;
        int n3 = n2 = pF2.c / 2;
        int n4 = pF2.c - 1;
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

    public void E() {
        int n2;
        PF a2;
        int n3 = Math.min(a2.b.length + a2.b.length / 2, a2.M);
        long[] lArray = new long[n3];
        jc_0[] jc_0Array = new jc_0[n3];
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            int n5 = n2;
            lArray[n5] = a2.b[n5];
            int n6 = n2++;
            jc_0Array[n6] = a2.C[n6];
            n4 = n2;
        }
        a2.b = lArray;
        a2.C = jc_0Array;
    }

    public PF(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        PF a3;
    }

    public jc_0 E(int a2) {
        PF a3;
        if (a2 >= a3.c) {
            return null;
        }
        return a3.C[a2];
    }

    public long E(int a2) {
        PF a3;
        if (a2 >= a3.c) {
            return 0L;
        }
        return a3.b[a2];
    }

    public int E() {
        PF a2;
        return a2.c;
    }
}

