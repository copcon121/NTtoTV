/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.SE
 */
public class se_1 {
    private long[] A;
    private final boolean C;
    private double[] M;
    private final int b;
    private int c;

    public void A() {
        se_1 a2;
        a2.void_E(0);
    }

    public int j(long a2) {
        int n2;
        se_1 a3;
        if (a3.c == 0) {
            return -1;
        }
        se_1 se_12 = a3;
        if (a2 > se_12.A[se_12.c - 1]) {
            return -1;
        }
        if (a2 < a3.A[0]) {
            return 0;
        }
        se_1 se_13 = a3;
        int n3 = n2 = se_13.c / 2;
        int n4 = se_13.c - 1;
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

    public int int_j() {
        se_1 a2;
        return a2.c;
    }

    public void d() {
        int n2;
        se_1 a2;
        int n3 = Math.min(a2.A.length + a2.A.length / 2, a2.b);
        long[] lArray = new long[n3];
        double[] dArray = new double[n3];
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            int n5 = n2;
            lArray[n5] = a2.A[n5];
            int n6 = n2++;
            dArray[n6] = a2.M[n6];
            n4 = n2;
        }
        a2.A = lArray;
        a2.M = dArray;
    }

    public double double_E(int a2) {
        se_1 a3;
        if (a2 >= a3.c) {
            return 0.0;
        }
        return a3.M[a2];
    }

    public int E(long a2) {
        int n2;
        se_1 a3;
        if (a3.c == 0) {
            return -1;
        }
        if (a2 < a3.A[0]) {
            return -1;
        }
        se_1 se_12 = a3;
        if (a2 > se_12.A[se_12.c - 1]) {
            return a3.c - 1;
        }
        se_1 se_13 = a3;
        int n3 = n2 = se_13.c / 2;
        int n4 = se_13.c - 1;
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

    public void a() {
        int n2;
        se_1 a2;
        se_1 se_12 = a2;
        long[] lArray = new long[a2.c - se_12.c / 4 + 1];
        double[] dArray = new double[se_12.c - a2.c / 4 + 1];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.A[n2];
                dArray[n3++] = a2.M[n2];
            }
            n4 = ++n2;
        }
        se_1 se_13 = a2;
        se_13.A = lArray;
        se_13.M = dArray;
        a2.c = n3;
    }

    public int int_E() {
        se_1 a2;
        return a2.A.length;
    }

    public long long_E(int a2) {
        se_1 a3;
        if (a2 >= a3.c) {
            return 0L;
        }
        return a3.A[a2];
    }

    public se_1(int a2, int a3, boolean a4) {
        se_1 a5;
        se_1 se_12 = a5;
        se_1 se_13 = a5;
        se_13.c = 0;
        se_13.C = a4;
        int n2 = a2;
        se_13.b = Math.max(a3, n2);
        se_12.A = new long[n2];
        se_12.M = new double[a2];
    }

    public void void_j() {
        a.c = 0;
    }

    public void void_E() {
        int n2;
        se_1 a2;
        long[] lArray = new long[a2.A.length];
        double[] dArray = new double[a2.A.length];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.A[n2];
                dArray[n3++] = a2.M[n2];
            }
            n4 = ++n2;
        }
        se_1 se_12 = a2;
        se_12.A = lArray;
        se_12.M = dArray;
        a2.c = n3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 4 ^ (2 << 2 ^ 3);
        int cfr_ignored_0 = 1 << 3 ^ 2;
        int n5 = n3;
        int n6 = 2 << 3 ^ 4;
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

    public se_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        se_1 a3;
    }

    public void void_E(int a22) {
        int n2;
        se_1 a3;
        if ((a22 = Math.max(a22, Math.max(a3.c, 1))) >= a3.A.length) {
            return;
        }
        long[] lArray = new long[a22];
        double[] a22 = new double[a22];
        int n3 = n2 = 0;
        while (n3 < a3.c) {
            int n4 = n2;
            lArray[n4] = a3.A[n4];
            int n5 = n2++;
            a22[n5] = a3.M[n5];
            n3 = n2;
        }
        a3.A = lArray;
        a3.M = a22;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, double a3) {
        se_1 se_12;
        se_1 a4;
        se_1 se_13 = a4;
        if (se_13.c == se_13.A.length) {
            se_1 se_14 = a4;
            if (se_14.b > se_14.A.length) {
                se_1 se_15 = a4;
                se_12 = se_15;
                se_15.d();
            } else {
                if (!a4.C) return;
                se_1 se_16 = a4;
                se_12 = se_16;
                se_16.void_E();
            }
        } else {
            se_12 = a4;
        }
        se_12.A[a4.c] = a2;
        a4.M[a4.c++] = a3;
    }
}

