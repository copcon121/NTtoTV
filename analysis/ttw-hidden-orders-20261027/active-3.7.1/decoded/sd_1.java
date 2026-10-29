/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ac_2;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.sD
 */
public class sd_1 {
    private long[] A;
    private final boolean C;
    private int M;
    private final int b;
    private ac_2[] c;

    public void A() {
        int n2;
        sd_1 a2;
        int n3 = Math.max(a2.A.length, 9);
        long[] lArray = new long[n3];
        ac_2[] ac_2Array = new ac_2[n3];
        int n4 = 0;
        int n5 = n2 = 0;
        while (n5 < a2.M) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n4] = a2.A[n2];
                ac_2Array[n4++] = a2.c[n2];
            }
            n5 = ++n2;
        }
        sd_1 sd_12 = a2;
        sd_12.A = lArray;
        sd_12.c = ac_2Array;
        a2.M = n4;
    }

    public void d() {
        int n2;
        sd_1 a2;
        int n3 = Math.min(a2.A.length + a2.A.length / 2, a2.b);
        long[] lArray = new long[n3];
        ac_2[] ac_2Array = new ac_2[n3];
        int n4 = n2 = 0;
        while (n4 < a2.M) {
            int n5 = n2;
            lArray[n5] = a2.A[n5];
            int n6 = n2++;
            ac_2Array[n6] = a2.c[n6];
            n4 = n2;
        }
        a2.A = lArray;
        a2.c = ac_2Array;
    }

    public void a() {
        int n2;
        sd_1 a2;
        sd_1 sd_12 = a2;
        long[] lArray = new long[a2.M - sd_12.M / 4 + 1];
        ac_2[] ac_2Array = new ac_2[sd_12.M - a2.M / 4 + 1];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.M) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.A[n2];
                ac_2Array[n3++] = a2.c[n2];
            }
            n4 = ++n2;
        }
        sd_1 sd_13 = a2;
        sd_13.A = lArray;
        sd_13.c = ac_2Array;
        a2.M = n3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 3 ^ 1;
        int cfr_ignored_0 = 5 << 4 ^ (2 ^ 5);
        int n5 = n3;
        int n6 = (2 ^ 5) << 3 ^ (2 ^ 5);
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
        sd_1 a3;
        if (a3.M == 0) {
            return -1;
        }
        sd_1 sd_12 = a3;
        if (a2 > sd_12.A[sd_12.M - 1]) {
            return -1;
        }
        if (a2 < a3.A[0]) {
            return 0;
        }
        sd_1 sd_13 = a3;
        int n3 = n2 = sd_13.M / 2;
        int n4 = sd_13.M - 1;
        long l2 = a2;
        while (l2 != a3.A[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.A[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.A[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.A[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    public int E(long a2) {
        int n2;
        sd_1 a3;
        if (a3.M == 0) {
            return -1;
        }
        if (a2 < a3.A[0]) {
            return -1;
        }
        sd_1 sd_12 = a3;
        if (a2 > sd_12.A[sd_12.M - 1]) {
            return a3.M - 1;
        }
        sd_1 sd_13 = a3;
        int n3 = n2 = sd_13.M / 2;
        int n4 = sd_13.M - 1;
        long l2 = a2;
        while (l2 != a3.A[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.A[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.A[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.A[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    public ac_2 E(int a2) {
        sd_1 a3;
        if (a2 >= a3.M) {
            return null;
        }
        return a3.c[a2];
    }

    public int j() {
        sd_1 a2;
        return a2.A.length;
    }

    public int E() {
        sd_1 a2;
        return a2.M;
    }

    public sd_1(int a2, int a3, boolean a4) {
        sd_1 a5;
        sd_1 sd_12 = a5;
        sd_1 sd_13 = a5;
        sd_13.M = 0;
        sd_13.C = a4;
        int n2 = a2;
        sd_13.b = Math.max(a3, n2);
        sd_12.A = new long[n2];
        sd_12.c = new ac_2[a2];
    }

    public long E(int a2) {
        sd_1 a3;
        if (a2 >= a3.M) {
            return 0L;
        }
        return a3.A[a2];
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, ac_2 a3) {
        sd_1 sd_12;
        sd_1 a4;
        sd_1 sd_13 = a4;
        if (sd_13.M == sd_13.A.length) {
            sd_1 sd_14 = a4;
            if (sd_14.b > sd_14.A.length) {
                sd_1 sd_15 = a4;
                sd_12 = sd_15;
                sd_15.d();
            } else {
                if (!a4.C) return;
                sd_1 sd_16 = a4;
                sd_12 = sd_16;
                sd_16.A();
            }
        } else {
            sd_12 = a4;
        }
        sd_12.A[a4.M] = a2;
        a4.c[a4.M++] = a3;
    }

    public void j() {
        int n2;
        sd_1 a2;
        sd_1 sd_12 = a2;
        long[] lArray = new long[sd_12.M];
        ac_2[] ac_2Array = new ac_2[sd_12.M];
        int n3 = n2 = 0;
        while (n3 < a2.M) {
            int n4 = n2;
            lArray[n4] = a2.A[n4];
            int n5 = n2++;
            ac_2Array[n5] = a2.c[n5];
            n3 = n2;
        }
        a2.A = lArray;
        a2.c = ac_2Array;
    }

    public sd_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        sd_1 a3;
    }

    public void E() {
        sd_1 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.M) {
            a2.c[n2++] = null;
            n3 = n2;
        }
        a2.M = 0;
    }
}

