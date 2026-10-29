/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.pb_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.ue
 */
public class ue_0 {
    private final boolean A;
    private int C;
    private final int M;
    private pb_2[] b;
    private long[] c;

    public int j(long a2) {
        int n2;
        ue_0 a3;
        if (a3.C == 0) {
            return -1;
        }
        ue_0 ue_02 = a3;
        if (a2 > ue_02.c[ue_02.C - 1]) {
            return -1;
        }
        if (a2 < a3.c[0]) {
            return 0;
        }
        ue_0 ue_03 = a3;
        int n3 = n2 = ue_03.C / 2;
        int n4 = ue_03.C - 1;
        long l2 = a2;
        while (l2 != a3.c[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.c[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.c[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.c[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    public int j() {
        ue_0 a2;
        return a2.C;
    }

    public void A() {
        int n2;
        ue_0 a2;
        int n3 = Math.max(a2.c.length, 5);
        long[] lArray = new long[n3];
        pb_2[] pb_2Array = new pb_2[n3];
        int n4 = 0;
        pb_2 pb_22 = null;
        int n5 = n2 = 0;
        while (n5 < a2.C) {
            pb_2 pb_23 = a2.b[n2];
            if (n2 % 4 == 0 && n2 != 0) {
                pb_22 = pb_23;
            } else {
                if (pb_22 != null) {
                    pb_23.E(pb_22);
                    pb_22 = null;
                }
                lArray[n4] = a2.c[n2];
                pb_2Array[n4++] = pb_23;
            }
            n5 = ++n2;
        }
        if (pb_22 != null) {
            int n6 = n4;
            long l2 = lArray[n4 - 1] + 1L;
            ++n4;
            lArray[n6] = l2;
            pb_2Array[n6] = pb_22;
        }
        ue_0 ue_02 = a2;
        ue_02.c = lArray;
        ue_02.b = pb_2Array;
        a2.C = n4;
    }

    public int E() {
        ue_0 a2;
        return a2.c.length;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, pb_2 a3) {
        ue_0 ue_02;
        ue_0 a4;
        ue_0 ue_03 = a4;
        if (ue_03.C == ue_03.c.length) {
            ue_0 ue_04 = a4;
            if (ue_04.M > ue_04.c.length) {
                ue_0 ue_05 = a4;
                ue_02 = ue_05;
                ue_05.d();
            } else {
                if (!a4.A) return;
                ue_0 ue_06 = a4;
                ue_02 = ue_06;
                ue_06.A();
            }
        } else {
            ue_02 = a4;
        }
        ue_02.c[a4.C] = a2;
        a4.b[a4.C++] = a3;
    }

    public void d() {
        int n2;
        ue_0 a2;
        int n3 = Math.min(a2.c.length + a2.c.length / 2, a2.M);
        long[] lArray = new long[n3];
        pb_2[] pb_2Array = new pb_2[n3];
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            int n5 = n2;
            lArray[n5] = a2.c[n5];
            int n6 = n2++;
            pb_2Array[n6] = a2.b[n6];
            n4 = n2;
        }
        a2.c = lArray;
        a2.b = pb_2Array;
    }

    public pb_2 E(int a2) {
        ue_0 a3;
        if (a2 >= a3.C) {
            return null;
        }
        return a3.b[a2];
    }

    public ue_0(int a2, int a3, boolean a4) {
        ue_0 a5;
        ue_0 ue_02 = a5;
        ue_0 ue_03 = a5;
        ue_03.C = 0;
        ue_03.A = a4;
        int n2 = a2;
        ue_03.M = Math.max(a3, n2);
        ue_02.c = new long[n2];
        ue_02.b = new pb_2[a2];
    }

    public void a() {
        int n2;
        ue_0 a2;
        ue_0 ue_02 = a2;
        long[] lArray = new long[ue_02.C];
        pb_2[] pb_2Array = new pb_2[ue_02.C];
        int n3 = n2 = 0;
        while (n3 < a2.C) {
            int n4 = n2;
            lArray[n4] = a2.c[n4];
            int n5 = n2++;
            pb_2Array[n5] = a2.b[n5];
            n3 = n2;
        }
        a2.c = lArray;
        a2.b = pb_2Array;
    }

    public void j() {
        int n2;
        ue_0 a2;
        ue_0 ue_02 = a2;
        long[] lArray = new long[a2.C - ue_02.C / 4 + 1];
        pb_2[] pb_2Array = new pb_2[ue_02.C - a2.C / 4 + 1];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.c[n2];
                pb_2Array[n3++] = a2.b[n2];
            }
            n4 = ++n2;
        }
        ue_0 ue_03 = a2;
        ue_03.c = lArray;
        ue_03.b = pb_2Array;
        a2.C = n3;
    }

    public int E(long a2) {
        int n2;
        ue_0 a3;
        if (a3.C == 0) {
            return -1;
        }
        if (a2 < a3.c[0]) {
            return -1;
        }
        ue_0 ue_02 = a3;
        if (a2 > ue_02.c[ue_02.C - 1]) {
            return a3.C - 1;
        }
        ue_0 ue_03 = a3;
        int n3 = n2 = ue_03.C / 2;
        int n4 = ue_03.C - 1;
        long l2 = a2;
        while (l2 != a3.c[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.c[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.c[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.c[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    public long E(int a2) {
        ue_0 a3;
        if (a2 >= a3.C) {
            return 0L;
        }
        return a3.c[a2];
    }

    public ue_0(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        ue_0 a3;
    }

    public void E() {
        ue_0 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.C) {
            a2.b[n2++] = null;
            n3 = n2;
        }
        a2.C = 0;
    }
}

