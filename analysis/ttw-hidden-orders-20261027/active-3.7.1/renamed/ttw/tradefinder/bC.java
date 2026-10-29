/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ha_1;

public class bC {
    private final String c;

    public bC(String a2) {
        bC a3;
        a3.c = a2;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 2;
        int cfr_ignored_0 = 5 << 4 ^ 5 << 1;
        int n5 = n3;
        int n6 = 3 << 3 ^ (3 ^ 5);
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

    public ha_1 E() {
        bC a2;
        return new ha_1(a2.c);
    }
}

