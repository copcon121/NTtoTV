/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

public class vE {
    public final String M;
    public final boolean b;
    public final String c;

    public boolean j() {
        vE a2;
        return a2.c == null || a2.c.isEmpty();
    }

    public boolean E() {
        vE a2;
        return a2.M == null || a2.M.isEmpty();
    }

    public vE(String a2) {
        a3(a2, "", false);
        vE a3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ (2 ^ 5);
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ 5 << 1;
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ (2 << 2 ^ 3);
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

    public vE(String a2, String a3, boolean a4) {
        vE a5;
        vE vE2 = a5;
        a5.M = a2;
        vE2.c = a3;
        vE2.b = a4;
    }

    public vE(String a2, String a3) {
        a4(a2, a3, false);
        vE a4;
    }

    public vE() {
        a2("", "", false);
        vE a2;
    }

    public vE(String a2, boolean a3) {
        a4(a2, "", a3);
        vE a4;
    }
}

