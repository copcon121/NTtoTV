/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.na_0;

/*
 * Renamed from ttw.tradefinder.GB
 */
public class gb_1 {
    public boolean C;
    public boolean M;
    public final int b;
    public final na_0 c;

    public boolean E(int a2, int a3) {
        gb_1 a4;
        if (!a4.C) {
            if (a3 == 0 || a2 == 0) {
                return false;
            }
            a4.M = a4.c.H < a3;
            a4.C = true;
        }
        if (a4.M && a3 <= a4.c.H) {
            return true;
        }
        return !a4.M && a2 >= a4.c.H;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 5;
        int cfr_ignored_0 = 5 << 3 ^ 2;
        int n5 = n3;
        int n6 = 4 << 4 ^ 1;
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

    public gb_1(int a2, na_0 a3, int a4, int a5) {
        gb_1 a6;
        gb_1 gb_12 = a6;
        gb_1 gb_13 = a6;
        gb_13.M = false;
        gb_13.C = false;
        gb_12.c = a3;
        gb_12.b = a2;
        if (a5 == 0 || a4 == 0) {
            a6.C = false;
            return;
        }
        a6.M = a6.c.H < a5;
        a6.C = true;
    }
}

