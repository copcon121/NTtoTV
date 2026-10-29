/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.BF
 */
public class bf_0 {
    private long[] D;
    private boolean[] A;
    private int[] C;
    private final boolean M;
    private final int b;
    private int c;

    public long long_E(int a2) {
        bf_0 a3;
        if (a2 >= a3.c) {
            return 0L;
        }
        return a3.D[a2];
    }

    public int int_E(int a2) {
        bf_0 a3;
        if (a2 >= a3.c) {
            return 0;
        }
        return a3.C[a2];
    }

    public void a() {
        int n2;
        bf_0 a2;
        int n3 = Math.min(a2.D.length + a2.D.length / 2, a2.b);
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        boolean[] blArray = new boolean[n3];
        int n4 = n2 = 0;
        while (n4 < a2.c) {
            int n5 = n2;
            lArray[n5] = a2.D[n5];
            int n6 = n2;
            nArray[n6] = a2.C[n6];
            int n7 = n2++;
            blArray[n7] = a2.A[n7];
            n4 = n2;
        }
        bf_0 bf_02 = a2;
        bf_02.D = lArray;
        bf_02.C = nArray;
        a2.A = blArray;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 5;
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ 2 << 1;
        int n5 = n3;
        int n6 = (2 ^ 5) << 3 ^ 4;
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

    public bf_0(int a2, int a3, boolean a4) {
        bf_0 a5;
        bf_0 bf_02 = a5;
        int n2 = a2;
        bf_0 bf_03 = a5;
        a5.c = 0;
        bf_03.M = a4;
        bf_03.b = Math.max(a3, a2);
        a5.D = new long[n2];
        bf_02.C = new int[n2];
        bf_02.A = new boolean[a2];
    }

    public bf_0(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        bf_0 a3;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, int a3, boolean a4) {
        bf_0 bf_02;
        bf_0 a5;
        bf_0 bf_03 = a5;
        if (bf_03.c == bf_03.D.length) {
            bf_0 bf_04 = a5;
            if (bf_04.b > bf_04.D.length) {
                bf_0 bf_05 = a5;
                bf_02 = bf_05;
                bf_05.a();
            } else {
                if (!a5.M) return;
                bf_0 bf_06 = a5;
                bf_02 = bf_06;
                bf_06.void_j();
            }
        } else {
            bf_02 = a5;
        }
        bf_02.D[a5.c] = a2;
        bf_0 bf_07 = a5;
        a5.C[bf_07.c] = a3;
        bf_07.A[a5.c++] = a4;
    }

    public void void_j() {
        int n2;
        bf_0 a2;
        int n3 = Math.max(a2.D.length, 9);
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        boolean[] blArray = new boolean[n3];
        int n4 = 0;
        int n5 = 0;
        int n6 = 0;
        int n7 = n2 = 0;
        while (n7 < a2.c) {
            bf_0 bf_02 = a2;
            boolean bl = bf_02.A[n2];
            int n8 = bf_02.C[n2];
            if (n2 % 4 == 0 && n2 != 0) {
                if (bl) {
                    n5 += a2.C[n2];
                } else {
                    n6 += a2.C[n2];
                }
            } else {
                long[] lArray2;
                if (n5 != 0 && bl) {
                    n8 += n5;
                    n5 = 0;
                    lArray2 = lArray;
                } else {
                    if (n6 != 0 && !bl) {
                        n8 += n6;
                        n6 = 0;
                    }
                    lArray2 = lArray;
                }
                lArray2[n4] = a2.D[n2];
                int n9 = n4++;
                nArray[n9] = n8;
                blArray[n9] = bl;
            }
            n7 = ++n2;
        }
        if (n5 != 0) {
            int n10 = n4;
            lArray[n4] = lArray[n4 - 1] + 1L;
            ++n4;
            nArray[n10] = n5;
            blArray[n10] = true;
        }
        if (n6 != 0) {
            int n11 = n4;
            lArray[n4] = lArray[n4 - 1] + 1L;
            ++n4;
            nArray[n11] = n6;
            blArray[n11] = false;
        }
        bf_0 bf_03 = a2;
        a2.D = lArray;
        bf_03.C = nArray;
        bf_03.A = blArray;
        a2.c = n4;
    }

    public int j(long a2) {
        int n2;
        bf_0 a3;
        if (a3.c == 0) {
            return -1;
        }
        bf_0 bf_02 = a3;
        if (a2 > bf_02.D[bf_02.c - 1]) {
            return -1;
        }
        if (a2 < a3.D[0]) {
            return 0;
        }
        bf_0 bf_03 = a3;
        int n3 = n2 = bf_03.c / 2;
        int n4 = bf_03.c - 1;
        long l2 = a2;
        while (l2 != a3.D[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.D[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 <= a3.D[n3] && n3 > 0) {
            l3 = a2;
            --n3;
        }
        long l4 = a2;
        while (l4 > a3.D[n3] && n3 < n4) {
            l4 = a2;
            ++n3;
        }
        return n3;
    }

    public int E(long a2) {
        int n2;
        bf_0 a3;
        if (a3.c == 0) {
            return -1;
        }
        if (a2 < a3.D[0]) {
            return -1;
        }
        bf_0 bf_02 = a3;
        if (a2 > bf_02.D[bf_02.c - 1]) {
            return a3.c - 1;
        }
        bf_0 bf_03 = a3;
        int n3 = n2 = bf_03.c / 2;
        int n4 = bf_03.c - 1;
        long l2 = a2;
        while (l2 != a3.D[n3] && (n2 /= 2) != 0) {
            if (a2 < a3.D[n3]) {
                n3 -= n2;
                l2 = a2;
                continue;
            }
            n3 += n2;
            l2 = a2;
        }
        long l3 = a2;
        while (l3 >= a3.D[n3] && n3 < n4) {
            l3 = a2;
            ++n3;
        }
        long l4 = a2;
        while (l4 < a3.D[n3] && n3 > 0) {
            l4 = a2;
            --n3;
        }
        return n3;
    }

    public boolean boolean_E(int a2) {
        bf_0 a3;
        if (a2 >= a3.c) {
            return false;
        }
        return a3.A[a2];
    }

    public int int_j() {
        bf_0 a2;
        return a2.D.length;
    }

    public void void_E() {
        int n2;
        bf_0 a2;
        bf_0 bf_02 = a2;
        if (bf_02.c >= bf_02.D.length) {
            return;
        }
        bf_0 bf_03 = a2;
        long[] lArray = new long[bf_03.c];
        int[] nArray = new int[bf_03.c];
        boolean[] blArray = new boolean[bf_03.c];
        int n3 = n2 = 0;
        while (n3 < a2.c) {
            int n4 = n2;
            lArray[n4] = a2.D[n4];
            int n5 = n2;
            nArray[n5] = a2.C[n5];
            int n6 = n2++;
            blArray[n6] = a2.A[n6];
            n3 = n2;
        }
        bf_0 bf_04 = a2;
        bf_04.D = lArray;
        bf_04.C = nArray;
        a2.A = blArray;
    }

    public int int_E() {
        bf_0 a2;
        return a2.c;
    }
}

