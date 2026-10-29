/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ge_0;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.tE
 */
public class te_0 {
    private long[] C;
    private ge_0[] M;
    private final int b;
    private int c;

    public ge_0 E(int a2) {
        te_0 a3;
        if (a2 >= a3.c) {
            return null;
        }
        return a3.M[a2];
    }

    public void a() {
        int n2;
        te_0 a2;
        int n3 = Math.min(a2.C.length + a2.C.length / 2, a2.b);
        long[] lArray = new long[n3];
        ge_0[] ge_0Array = new ge_0[n3];
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            int n5 = n2;
            lArray[n5] = a2.C[n5];
            int n6 = n2++;
            ge_0Array[n6] = a2.M[n6];
            n4 = n2;
        }
        a2.C = lArray;
        a2.M = ge_0Array;
    }

    public long E(int a2) {
        te_0 a3;
        if (a2 >= a3.c) {
            return 0L;
        }
        return a3.C[a2];
    }

    public int j() {
        te_0 a2;
        return a2.c;
    }

    public te_0(int a2, int a3) {
        te_0 a4;
        te_0 te_02 = a4;
        a4.c = 0;
        int n2 = a2;
        a4.b = Math.max(a3, n2);
        te_02.C = new long[n2];
        te_02.M = new ge_0[a2];
    }

    public te_0(int a2) {
        a3(a2, Integer.MAX_VALUE);
        te_0 a3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 4 ^ 4 << 1;
        int cfr_ignored_0 = 5 << 4 ^ (2 ^ 5);
        int n5 = n3;
        int n6 = (2 ^ 5) << 3 ^ 3;
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

    public int j(long a2) {
        int n2;
        te_0 a3;
        if (a3.c == 0) {
            return -1;
        }
        if (a2 < a3.C[0]) {
            return -1;
        }
        te_0 te_02 = a3;
        if (a2 > te_02.C[te_02.c - 1]) {
            return a3.c - 1;
        }
        te_0 te_03 = a3;
        int n3 = n2 = te_03.c / 2;
        int n4 = te_03.c - 1;
        long l2 = a2;
        while (l2 != a3.C[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.C[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.C[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.C[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    public int E() {
        te_0 a2;
        return a2.C.length;
    }

    public void j() {
        te_0 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            a2.M[n2++] = null;
            n3 = n2;
        }
        a2.c = 0;
    }

    public int E(long a2) {
        int n2;
        te_0 a3;
        if (a3.c == 0) {
            return -1;
        }
        te_0 te_02 = a3;
        if (a2 > te_02.C[te_02.c - 1]) {
            return -1;
        }
        if (a2 < a3.C[0]) {
            return 0;
        }
        te_0 te_03 = a3;
        int n3 = n2 = te_03.c / 2;
        int n4 = te_03.c - 1;
        long l2 = a2;
        while (l2 != a3.C[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.C[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.C[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.C[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, ge_0 a3) {
        te_0 te_02;
        te_0 a4;
        te_0 te_03 = a4;
        if (te_03.c == te_03.C.length) {
            te_0 te_04 = a4;
            if (te_04.b <= te_04.C.length) return;
            te_0 te_05 = a4;
            te_02 = te_05;
            te_05.a();
        } else {
            te_02 = a4;
        }
        te_02.C[a4.c] = a2;
        a4.M[a4.c++] = a3;
    }

    public void E() {
        int n2;
        te_0 a2;
        te_0 te_02 = a2;
        if (te_02.c >= te_02.C.length) {
            return;
        }
        te_0 te_03 = a2;
        long[] lArray = new long[te_03.c];
        ge_0[] ge_0Array = new ge_0[te_03.c];
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            int n4 = n2;
            lArray[n4] = a2.C[n4];
            int n5 = n2++;
            ge_0Array[n5] = a2.M[n5];
            n3 = n2;
        }
        a2.C = lArray;
        a2.M = ge_0Array;
    }
}

