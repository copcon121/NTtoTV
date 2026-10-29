/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.lE
 */
public class le_1 {
    private int M;
    private int[] b;
    private int c = 0;

    public void void_E() {
        le_1 a2;
        int n2;
        int n3 = n2 = 0;
        while (n3 < a2.M) {
            a2.b[n2++] = 0;
            n3 = n2;
        }
        a2.c = 0;
    }

    public void j(int a2) {
        le_1 a3;
        a3.b[a3.c++] = a2;
        le_1 le_12 = a3;
        if (le_12.c >= le_12.M) {
            a3.c = 0;
        }
    }

    public double double_E() {
        le_1 a2;
        int n2;
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.M) {
            n3 += a2.b[n2++];
            n4 = n2;
        }
        return (double)n3 / (double)a2.M;
    }

    public le_1(int a2) {
        le_1 a3;
        a3.M = a2;
        a3.b = new int[a2];
        a3.void_E();
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 5;
        int cfr_ignored_0 = 5 << 3 ^ 1;
        int n5 = n3;
        int n6 = 5 << 4 ^ (2 << 2 ^ 3);
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

    public int int_E() {
        le_1 a2;
        int n2;
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a2.M) {
            n3 += a2.b[n2++];
            n4 = n2;
        }
        return n3;
    }

    public void E(int a2) {
        int n2;
        le_1 a3;
        if (a2 == a3.M) {
            return;
        }
        int[] nArray = new int[a2];
        int n3 = 0;
        int n4 = n2 = 0;
        while (n4 < a3.M) {
            nArray[n3++] = a3.b[a3.c++];
            le_1 le_12 = a3;
            if (le_12.c >= le_12.M) {
                a3.c = 0;
            }
            if (n3 >= a2) {
                n3 = 0;
            }
            n4 = ++n2;
        }
        le_1 le_13 = a3;
        le_13.b = nArray;
        le_13.M = a2;
        a3.c = n3;
    }
}

