/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.gE
 */
public class ge_1 {
    private int C;
    private final boolean M;
    private long[] b;
    private final int c;

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 1 << 3;
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ 3 << 1;
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ (3 ^ 5) << 1;
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

    public void A() {
        a.C = 0;
    }

    public ge_1(int a2, int a3, boolean a4) {
        ge_1 a5;
        ge_1 ge_12 = a5;
        ge_1 ge_13 = a5;
        ge_13.C = 0;
        ge_13.M = a4;
        ge_12.c = Math.max(a3, a2);
        ge_12.b = new long[a2];
    }

    public void d() {
        int n2;
        ge_1 a2;
        long[] lArray = new long[a2.b.length];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3++] = a2.b[n2];
            }
            n4 = ++n2;
        }
        a2.b = lArray;
        a2.C = n3;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2) {
        ge_1 ge_12;
        ge_1 a3;
        ge_1 ge_13 = a3;
        if (ge_13.C == ge_13.b.length) {
            ge_1 ge_14 = a3;
            if (ge_14.c > ge_14.b.length) {
                ge_1 ge_15 = a3;
                ge_12 = ge_15;
                ge_15.void_j();
            } else {
                if (!a3.M) return;
                ge_1 ge_16 = a3;
                ge_12 = ge_16;
                ge_16.d();
            }
        } else {
            ge_12 = a3;
        }
        ge_12.b[a3.C++] = a2;
    }

    public void void_E(int a22) {
        int n2;
        ge_1 a3;
        if ((a22 = Math.max(a22, Math.max(a3.C, 1))) >= a3.b.length) {
            return;
        }
        long[] a22 = new long[a22];
        int n3 = n2 = 0;
        while (n3 < a3.C) {
            int n4 = n2++;
            a22[n4] = a3.b[n4];
            n3 = n2;
        }
        a3.b = a22;
    }

    public int int_j() {
        ge_1 a2;
        return a2.C;
    }

    public void a() {
        ge_1 a2;
        a2.void_E(0);
    }

    public void void_j() {
        int n2;
        ge_1 a2;
        int n3 = Math.min(a2.b.length + a2.b.length / 2, a2.c);
        long[] lArray = new long[n3];
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            int n5 = n2++;
            lArray[n5] = a2.b[n5];
            n4 = n2;
        }
        a2.b = lArray;
    }

    public ge_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        ge_1 a3;
    }

    public int int_E() {
        ge_1 a2;
        return a2.b.length;
    }

    public long long_E(int a2) {
        ge_1 a3;
        if (a2 >= a3.C) {
            return 0L;
        }
        return a3.b[a2];
    }

    public void void_E() {
        int n2;
        ge_1 a2;
        ge_1 ge_12 = a2;
        long[] lArray = new long[ge_12.C - ge_12.C / 4 + 1];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.C) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3++] = a2.b[n2];
            }
            n4 = ++n2;
        }
        a2.b = lArray;
        a2.C = n3;
    }
}

