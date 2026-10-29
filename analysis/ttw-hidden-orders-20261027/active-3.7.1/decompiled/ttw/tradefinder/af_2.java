/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.AF
 */
public class af_2 {
    public long b;
    public int c;

    public af_2(long a2, int a3) {
        af_2 a4;
        af_2 af_22 = a4;
        af_22.b = a2;
        af_22.c = a3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ (2 ^ 5) << 1;
        int cfr_ignored_0 = (3 ^ 5) << 3 ^ (2 ^ 5);
        int n5 = n3;
        int n6 = 2 << 3 ^ 3;
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

    public af_2() {
        a2(0L, 0);
        af_2 a2;
    }
}

