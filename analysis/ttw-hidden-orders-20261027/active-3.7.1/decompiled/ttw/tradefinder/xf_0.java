/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.xF
 */
public class xf_0 {
    private double C;
    private double M;
    private long b;
    private int c;

    public /* synthetic */ xf_0() {
        xf_0 a2;
        xf_0 xf_02 = a2;
        xf_0 xf_03 = a2;
        xf_03.C = 0.0;
        xf_03.b = 0L;
        xf_02.M = 1.0;
        xf_02.c = -1;
    }

    public /* synthetic */ void E(int a2) {
        xf_0 a3;
        if (a3.c == a2) {
            return;
        }
        xf_0 xf_02 = a3;
        a3.c = a2;
        xf_02.C = 0.0;
        xf_02.b = 0L;
        a3.M = 1.0E9 * (double)a2 / Math.log(2.0);
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 3 ^ 5;
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ 1 << 1;
        int n5 = n3;
        int n6 = 3 << 3 ^ 4;
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

    public /* synthetic */ double E(long a2) {
        xf_0 a3;
        if (a3.b == a2) {
            return a3.C;
        }
        a3.C *= Math.exp((double)(a3.b - a2) / a3.M);
        a3.b = a2;
        return a3.C;
    }

    public /* synthetic */ void E(long a2, int a3) {
        xf_0 a4;
        a4.C = a4.E(a2) + (double)a3;
    }

    public /* synthetic */ void E(long a2, double a3) {
        xf_0 a4;
        a4.C = a4.E(a2) + a3;
    }
}

