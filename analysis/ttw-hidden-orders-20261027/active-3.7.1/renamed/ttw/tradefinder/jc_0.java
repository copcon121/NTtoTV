/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.jC
 */
public class jc_0 {
    private double b;
    private final boolean c;

    public jc_0(double a2) {
        a3(a2, false);
        jc_0 a3;
    }

    public jc_0(double a2, boolean a3) {
        jc_0 a4;
        jc_0 jc_02 = a4;
        jc_02.b = a2;
        jc_02.c = a3;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ (3 << 2 ^ 3);
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ (3 ^ 5) << 1;
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

    public void E(jc_0 a2) {
        a.b += a2.b;
    }

    public boolean boolean_E() {
        jc_0 a2;
        return a2.c;
    }

    public double double_E() {
        jc_0 a2;
        return a2.b;
    }
}

