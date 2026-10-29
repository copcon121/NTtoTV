/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.ac
 */
public class ac_2 {
    public int M;
    public int b;
    public int c;

    public ac_2(int a2, int a3, int a4) {
        ac_2 a5;
        ac_2 ac_22 = a5;
        ac_2 ac_23 = a5;
        ac_2 ac_24 = a5;
        ac_24.M = 0;
        ac_24.b = 0;
        ac_23.c = 0;
        ac_23.M = a2;
        ac_22.b = a3;
        ac_22.c = a4;
    }

    public ac_2() {
        ac_2 a2;
        ac_2 ac_22 = a2;
        a2.M = 0;
        ac_22.b = 0;
        ac_22.c = 0;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 2 << 3 ^ 4;
        int cfr_ignored_0 = 3 << 3 ^ (2 ^ 5);
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 1 << 1;
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

