/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.kD
 */
public class kd_1 {
    private String[] D;
    private long[] A;
    private final boolean C;
    private final int M;
    private int b;
    private int[] c;

    public int int_a() {
        kd_1 a2;
        return a2.b;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public void E(String a2, long a3, int a4) {
        kd_1 kd_12;
        kd_1 a5;
        if (a2 == null || a2.isEmpty()) {
            return;
        }
        kd_1 kd_13 = a5;
        if (kd_13.b == kd_13.D.length) {
            kd_1 kd_14 = a5;
            if (kd_14.M > kd_14.D.length) {
                kd_1 kd_15 = a5;
                kd_12 = kd_15;
                kd_15.void_E();
            } else {
                if (!a5.C) return;
                kd_1 kd_16 = a5;
                kd_12 = kd_16;
                kd_16.d();
            }
        } else {
            kd_12 = a5;
        }
        kd_12.D[a5.b] = a2;
        kd_1 kd_17 = a5;
        a5.A[kd_17.b] = a3;
        kd_17.c[a5.b++] = a4;
    }

    public void d() {
        int n2;
        kd_1 a2;
        int n3 = Math.max(a2.D.length, 9);
        String[] stringArray = new String[n3];
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        int n4 = 0;
        int n5 = n2 = 0;
        while (n5 < a2.b) {
            if (n2 % 4 != 0 || n2 == 0) {
                stringArray[n4] = a2.D[n2];
                int n6 = n4++;
                lArray[n6] = a2.A[n2];
                nArray[n6] = a2.c[n2];
            }
            n5 = ++n2;
        }
        kd_1 kd_12 = a2;
        a2.D = stringArray;
        kd_12.A = lArray;
        kd_12.c = nArray;
        a2.b = n4;
    }

    public long long_E(int a2) {
        kd_1 a3;
        if (a2 >= a3.b) {
            return 0L;
        }
        return a3.A[a2];
    }

    public String java_lang_String_E(int a2) {
        kd_1 a3;
        if (a2 >= a3.b) {
            return "";
        }
        return a3.D[a2];
    }

    public int int_j() {
        kd_1 a2;
        return a2.D.length;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 3 << 1;
        int cfr_ignored_0 = 1 << 3;
        int n5 = n3;
        int n6 = 4 << 4 ^ 2 << 1;
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

    public int j(String a2) {
        int n2;
        kd_1 a3;
        if (a3.b == 0) {
            return -1;
        }
        if (a2.compareTo(a3.D[0]) < 0) {
            return -1;
        }
        kd_1 kd_12 = a3;
        if (a2.compareTo(kd_12.D[kd_12.b - 1]) > 0) {
            return a3.b - 1;
        }
        kd_1 kd_13 = a3;
        int n3 = n2 = kd_13.b / 2;
        int n4 = kd_13.b - 1;
        String string = a2;
        while (string != a3.D[n3] && (n2 /= 2) != 0) {
            if (a2.compareTo(a3.D[n3]) < 0) {
                n3 -= n2;
                string = a2;
                continue;
            }
            n3 += n2;
            string = a2;
        }
        String string2 = a2;
        while (string2.compareTo(a3.D[n3]) >= 0 && n3 < n4) {
            string2 = a2;
            ++n3;
        }
        String string3 = a2;
        while (string3.compareTo(a3.D[n3]) < 0 && n3 > 0) {
            string3 = a2;
            --n3;
        }
        return n3;
    }

    public kd_1(int a2) {
        a3(a2, Integer.MAX_VALUE, false);
        kd_1 a3;
    }

    public kd_1(int a2, int a3, boolean a4) {
        kd_1 a5;
        kd_1 kd_12 = a5;
        kd_1 kd_13 = a5;
        kd_13.b = 0;
        kd_13.C = a4;
        kd_12.M = Math.max(a3, a2);
        kd_12.D = new String[a2];
        kd_1 kd_14 = a5;
        kd_14.A = new long[a2];
        kd_14.c = new int[a2];
    }

    public void void_a() {
        kd_1 a2;
        int n2 = a2.D.length;
        a2.D = new String[n2];
        kd_1 kd_12 = a2;
        int n3 = n2;
        a2.A = new long[n3];
        kd_12.c = new int[n3];
        kd_12.b = 0;
    }

    public int E(String a2) {
        int n2;
        kd_1 a3;
        if (a3.b == 0) {
            return -1;
        }
        kd_1 kd_12 = a3;
        if (a2.compareTo(kd_12.D[kd_12.b - 1]) > 0) {
            return -1;
        }
        if (a2.compareTo(a3.D[0]) < 0) {
            return 0;
        }
        kd_1 kd_13 = a3;
        int n3 = n2 = kd_13.b / 2;
        int n4 = kd_13.b - 1;
        String string = a2;
        while (string != a3.D[n3] && (n2 /= 2) != 0) {
            if (a2.compareTo(a3.D[n3]) < 0) {
                n3 -= n2;
                string = a2;
                continue;
            }
            n3 += n2;
            string = a2;
        }
        String string2 = a2;
        while (string2.compareTo(a3.D[n3]) <= 0 && n3 > 0) {
            string2 = a2;
            --n3;
        }
        String string3 = a2;
        while (string3.compareTo(a3.D[n3]) > 0 && n3 < n4) {
            string3 = a2;
            ++n3;
        }
        return n3;
    }

    public int int_E() {
        kd_1 a2;
        return a2.b;
    }

    public void void_j() {
        int n2;
        kd_1 a2;
        kd_1 kd_12 = a2;
        if (kd_12.b >= kd_12.D.length) {
            return;
        }
        String[] stringArray = new String[a2.b];
        kd_1 kd_13 = a2;
        long[] lArray = new long[kd_13.b];
        int[] nArray = new int[kd_13.b];
        int n3 = n2 = 0;
        while (n3 < a2.b) {
            int n4 = n2;
            stringArray[n4] = a2.D[n4];
            int n5 = n2;
            lArray[n5] = a2.A[n5];
            int n6 = n2++;
            nArray[n6] = a2.c[n6];
            n3 = n2;
        }
        kd_1 kd_14 = a2;
        kd_14.D = stringArray;
        kd_14.A = lArray;
        a2.c = nArray;
    }

    public void void_E() {
        int n2;
        kd_1 a2;
        int n3 = Math.min(a2.D.length + a2.D.length / 2, a2.M);
        String[] stringArray = new String[n3];
        long[] lArray = new long[n3];
        int[] nArray = new int[n3];
        int n4 = n2 = 0;
        while (n4 < a2.b) {
            int n5 = n2;
            stringArray[n5] = a2.D[n5];
            int n6 = n2;
            lArray[n6] = a2.A[n6];
            int n7 = n2++;
            nArray[n7] = a2.c[n7];
            n4 = n2;
        }
        kd_1 kd_12 = a2;
        kd_12.D = stringArray;
        kd_12.A = lArray;
        a2.c = nArray;
    }

    public int int_E(int a2) {
        kd_1 a3;
        if (a2 >= a3.b) {
            return 0;
        }
        return a3.c[a2];
    }
}

