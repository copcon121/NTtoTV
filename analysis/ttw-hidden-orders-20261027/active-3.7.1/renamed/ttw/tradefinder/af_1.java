/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.pe_2;

/*
 * Renamed from ttw.tradefinder.aF
 */
public class af_1 {
    private int A;
    private final int C;
    private final boolean M;
    private pe_2[] b;
    private long[] c;

    public int int_j() {
        af_1 a2;
        return a2.c.length;
    }

    public void d() {
        int n2;
        af_1 a2;
        int n3 = Math.max(a2.c.length, 9);
        long[] lArray = new long[n3];
        pe_2[] pe_2Array = new pe_2[n3];
        int n4 = 0;
        pe_2 pe_22 = null;
        pe_2 pe_23 = null;
        int n5 = n2 = 0;
        while (n5 < a2.A) {
            pe_2 pe_24 = a2.b[n2];
            if (n2 % 4 == 0 && n2 != 0) {
                if (pe_24.b) {
                    if (pe_23 != null) {
                        pe_23.E(pe_24.c);
                    } else {
                        pe_23 = pe_24;
                    }
                } else if (pe_22 != null) {
                    pe_22.E(pe_24.c);
                } else {
                    pe_22 = pe_24;
                }
            } else {
                long[] lArray2;
                if (pe_23 != null && pe_24.b) {
                    pe_24.E(pe_23.c);
                    pe_23 = null;
                    lArray2 = lArray;
                } else {
                    if (pe_22 != null && !pe_24.b) {
                        pe_24.E(pe_22.c);
                        pe_22 = null;
                    }
                    lArray2 = lArray;
                }
                lArray2[n4] = a2.c[n2];
                pe_2Array[n4++] = pe_24;
            }
            n5 = ++n2;
        }
        if (pe_23 != null) {
            int n6 = n4;
            long l2 = lArray[n4 - 1] + 1L;
            ++n4;
            lArray[n6] = l2;
            pe_2Array[n6] = pe_23;
        }
        if (pe_22 != null) {
            int n7 = n4;
            long l3 = lArray[n4 - 1] + 1L;
            ++n4;
            lArray[n7] = l3;
            pe_2Array[n7] = pe_22;
        }
        af_1 af_12 = a2;
        af_12.c = lArray;
        af_12.b = pe_2Array;
        a2.A = n4;
    }

    public int int_E() {
        af_1 a2;
        return a2.A;
    }

    public af_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        af_1 a3;
    }

    public int j(long a2) {
        int n2;
        af_1 a3;
        if (a3.A == 0) {
            return -1;
        }
        af_1 af_12 = a3;
        if (a2 > af_12.c[af_12.A - 1]) {
            return -1;
        }
        if (a2 < a3.c[0]) {
            return 0;
        }
        af_1 af_13 = a3;
        int n3 = n2 = af_13.A / 2;
        int n4 = af_13.A - 1;
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

    public int E(long a2) {
        int n2;
        af_1 a3;
        if (a3.A == 0) {
            return -1;
        }
        if (a2 < a3.c[0]) {
            return -1;
        }
        af_1 af_12 = a3;
        if (a2 > af_12.c[af_12.A - 1]) {
            return a3.A - 1;
        }
        af_1 af_13 = a3;
        int n3 = n2 = af_13.A / 2;
        int n4 = af_13.A - 1;
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

    public af_1(int a2, int a3, boolean a4) {
        af_1 a5;
        af_1 af_12 = a5;
        af_1 af_13 = a5;
        af_13.A = 0;
        af_13.M = a4;
        int n2 = a2;
        af_13.C = Math.max(a3, n2);
        af_12.c = new long[n2];
        af_12.b = new pe_2[a2];
    }

    public pe_2 ttw_tradefinder_pe_2_E(int a2) {
        af_1 a3;
        if (a2 >= a3.A) {
            return null;
        }
        return a3.b[a2];
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, pe_2 a3) {
        af_1 af_12;
        af_1 a4;
        af_1 af_13 = a4;
        if (af_13.A == af_13.c.length) {
            af_1 af_14 = a4;
            if (af_14.C > af_14.c.length) {
                af_1 af_15 = a4;
                af_12 = af_15;
                af_15.void_j();
            } else {
                if (!a4.M) return;
                af_1 af_16 = a4;
                af_12 = af_16;
                af_16.d();
            }
        } else {
            af_12 = a4;
        }
        af_12.c[a4.A] = a2;
        a4.b[a4.A++] = a3;
    }

    public void a() {
        af_1 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.A) {
            a2.b[n2++] = null;
            n3 = n2;
        }
        a2.A = 0;
    }

    public long long_E(int a2) {
        af_1 a3;
        if (a2 >= a3.A) {
            return 0L;
        }
        return a3.c[a2];
    }

    public void void_j() {
        int n2;
        af_1 a2;
        int n3 = Math.min(a2.c.length + a2.c.length / 2, a2.C);
        long[] lArray = new long[n3];
        pe_2[] pe_2Array = new pe_2[n3];
        int n4 = n2 = 0;
        while (n4 < a2.A) {
            int n5 = n2;
            lArray[n5] = a2.c[n5];
            int n6 = n2++;
            pe_2Array[n6] = a2.b[n6];
            n4 = n2;
        }
        a2.c = lArray;
        a2.b = pe_2Array;
    }

    public void void_E() {
        int n2;
        af_1 a2;
        af_1 af_12 = a2;
        long[] lArray = new long[af_12.A];
        pe_2[] pe_2Array = new pe_2[af_12.A];
        int n3 = n2 = 0;
        while (n3 < a2.A) {
            int n4 = n2;
            lArray[n4] = a2.c[n4];
            int n5 = n2++;
            pe_2Array[n5] = a2.b[n5];
            n3 = n2;
        }
        a2.c = lArray;
        a2.b = pe_2Array;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 5;
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ 2 << 1;
        int n5 = n3;
        int n6 = 1 << 3 ^ 1;
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

