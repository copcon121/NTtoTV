/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.BE
 */
public class be_0 {
    public int b;
    public double c;

    public be_0() {
        a2(0, 0.0);
        be_0 a2;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ (2 << 2 ^ 1);
        int cfr_ignored_0 = 5 << 4 ^ (3 << 2 ^ 1);
        int n5 = n3;
        int n6 = (2 ^ 5) << 3 ^ 5;
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

    public be_0(int a2, double a3) {
        be_0 a4;
        be_0 be_02 = a4;
        be_02.b = a2;
        be_02.c = a3;
    }

    public void E(double a2) {
        a.c += a2;
    }
}

