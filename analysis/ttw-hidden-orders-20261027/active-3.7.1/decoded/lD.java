/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.EventObject;

public class lD
extends EventObject {
    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 1 << 3 ^ (3 ^ 5);
        int cfr_ignored_0 = 1 << 3;
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ 1 << 1;
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

