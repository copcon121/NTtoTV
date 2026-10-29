/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.eD
 */
public class ed_0 {
    private int[] H;
    private final int D;
    private final int A;
    private int[] C;
    private long[] M;
    private int b;
    private final boolean c;

    public int a() {
        ed_0 a2;
        int n2;
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.b) {
            int n5 = a2.C[n2];
            if (n5 > 0) {
                n3 += a2.H[n2] * n5;
            }
            n4 = ++n2;
        }
        return n3;
    }

    public void d() {
        int n2;
        ed_0 a2;
        ed_0 ed_02 = a2;
        int n3 = ed_02.b - ed_02.b / 4 + 1;
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        int[] nArray2 = new int[n3];
        int n4 = 0;
        int n5 = n2 = 0;
        while (n5 < a2.b) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n4] = a2.M[n2];
                int n6 = n4++;
                nArray[n6] = a2.H[n2];
                nArray2[n6] = a2.C[n2];
            }
            n5 = ++n2;
        }
        ed_0 ed_03 = a2;
        a2.M = lArray;
        ed_03.H = nArray;
        ed_03.C = nArray2;
        a2.b = n4;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(long a2, int a3, int a4) {
        ed_0 ed_02;
        ed_0 a5;
        ed_0 ed_03 = a5;
        if (ed_03.b == ed_03.M.length) {
            ed_0 ed_04 = a5;
            if (ed_04.D > ed_04.M.length) {
                ed_0 ed_05 = a5;
                ed_02 = ed_05;
                ed_05.E();
            } else {
                if (!a5.c) return;
                ed_0 ed_06 = a5;
                ed_02 = ed_06;
                ed_06.j();
            }
        } else {
            ed_02 = a5;
        }
        ed_02.M[a5.b] = a2;
        ed_0 ed_07 = a5;
        a5.H[ed_07.b] = a3;
        ed_07.C[a5.b++] = a4;
    }

    public void a() {
        int n2;
        ed_0 a2;
        ed_0 ed_02 = a2;
        if (ed_02.b >= ed_02.M.length) {
            return;
        }
        ed_0 ed_03 = a2;
        long[] lArray = new long[ed_03.b];
        int[] nArray = new int[ed_03.b];
        int[] nArray2 = new int[ed_03.b];
        int n3 = n2 = 0;
        while (n3 < a2.b) {
            int n4 = n2;
            lArray[n4] = a2.M[n4];
            int n5 = n2;
            nArray[n5] = a2.H[n5];
            int n6 = n2++;
            nArray2[n6] = a2.C[n6];
            n3 = n2;
        }
        ed_0 ed_04 = a2;
        ed_04.M = lArray;
        ed_04.H = nArray;
        a2.C = nArray2;
    }

    public void j() {
        int n2;
        ed_0 a2;
        long[] lArray = new long[a2.M.length];
        int[] nArray = new int[a2.M.length];
        int[] nArray2 = new int[a2.M.length];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.b) {
            if (n2 % 4 != 0 || n2 == 0) {
                lArray[n3] = a2.M[n2];
                int n5 = n3++;
                nArray[n5] = a2.H[n2];
                nArray2[n5] = a2.C[n2];
            }
            n4 = ++n2;
        }
        ed_0 ed_02 = a2;
        a2.M = lArray;
        ed_02.H = nArray;
        ed_02.C = nArray2;
        a2.b = n3;
    }

    public int a(long a2) {
        ed_0 a3;
        int n2;
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a3.b) {
            if (a3.M[n2] > a2) {
                return n3;
            }
            int n5 = a3.C[n2];
            n3 += Math.max(0, n5);
            n4 = ++n2;
        }
        return n3;
    }

    public ed_0(int a2) {
        ed_0 a3;
        int n2 = a2;
        a3(n2, Integer.MAX_VALUE, n2, false);
    }

    public int j() {
        ed_0 a2;
        return a2.b;
    }

    public int j(long a2) {
        int n2;
        ed_0 a3;
        if (a3.b == 0) {
            return -1;
        }
        if (a2 < a3.M[0]) {
            return -1;
        }
        ed_0 ed_02 = a3;
        if (a2 > ed_02.M[ed_02.b - 1]) {
            return a3.b - 1;
        }
        ed_0 ed_03 = a3;
        int n3 = n2 = ed_03.b / 2;
        int n4 = ed_03.b - 1;
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

    public void E() {
        int n2;
        ed_0 a2;
        int n3 = Math.min(a2.M.length + a2.M.length / 2, a2.D);
        n3 = Math.max(n3, a2.A);
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        int[] nArray2 = new int[n3];
        int n4 = n2 = 0;
        while (n4 < a2.b) {
            int n5 = n2;
            lArray[n5] = a2.M[n5];
            int n6 = n2;
            nArray[n6] = a2.H[n6];
            int n7 = n2++;
            nArray2[n7] = a2.C[n7];
            n4 = n2;
        }
        ed_0 ed_02 = a2;
        ed_02.M = lArray;
        ed_02.H = nArray;
        a2.C = nArray2;
    }

    public ed_0(int a2, int a3) {
        a4(a2, Integer.MAX_VALUE, a3, false);
        ed_0 a4;
    }

    public ed_0(int a2, int a3, int a4, boolean a5) {
        ed_0 a6;
        ed_0 ed_02 = a6;
        int n2 = a2;
        ed_0 ed_03 = a6;
        ed_0 ed_04 = a6;
        ed_04.b = 0;
        ed_04.c = a5;
        ed_03.D = Math.max(a3, a2);
        ed_03.A = a4;
        a6.M = new long[n2];
        ed_02.H = new int[n2];
        ed_02.C = new int[a2];
    }

    public int E(long a2) {
        int n2;
        ed_0 a3;
        if (a3.b == 0) {
            return -1;
        }
        ed_0 ed_02 = a3;
        if (a2 > ed_02.M[ed_02.b - 1]) {
            return -1;
        }
        if (a2 < a3.M[0]) {
            return 0;
        }
        ed_0 ed_03 = a3;
        int n3 = n2 = ed_03.b / 2;
        int n4 = ed_03.b - 1;
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

    public int j(int a2) {
        ed_0 a3;
        if (a2 >= a3.b) {
            return 0;
        }
        return a3.C[a2];
    }

    public int E() {
        ed_0 a2;
        return a2.M.length;
    }

    public long E(int a2) {
        ed_0 a3;
        if (a2 >= a3.b) {
            return 0L;
        }
        return a3.M[a2];
    }

    public int E(int a2) {
        ed_0 a3;
        if (a2 >= a3.b) {
            return 0;
        }
        return a3.H[a2];
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ (2 ^ 5) << 1;
        int cfr_ignored_0 = 4 << 4 ^ 5;
        int n5 = n3;
        int n6 = (3 ^ 5) << 4;
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

