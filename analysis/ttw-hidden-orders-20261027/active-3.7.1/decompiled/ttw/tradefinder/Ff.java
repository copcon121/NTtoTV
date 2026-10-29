/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.lg_0;

public class Ff {
    public final boolean D;
    public final String A;
    public long C;
    public int M;
    public int b;
    public long c;

    public /* synthetic */ Ff(lg_0 a2, long a3, int a4) {
        Ff a5;
        Ff ff = a5;
        Ff ff2 = a5;
        Ff ff3 = a5;
        Ff ff4 = a5;
        Ff ff5 = a5;
        ff5.c = 0L;
        ff5.C = 0L;
        ff4.b = 0;
        ff4.M = 0;
        ff3.D = a2.D;
        ff3.A = a2.M;
        ff2.c = a3;
        ff2.C = a2.h;
        ff.b = a4;
        ff.M = a2.c;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 4 ^ 2 << 1;
        int cfr_ignored_0 = 4 << 3 ^ 2;
        int n5 = n3;
        int n6 = 4 << 3 ^ 2;
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

