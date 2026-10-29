/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.me
 */
public class me_1 {
    private double M;
    private double b;
    private long c;

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 2 << 3 ^ 3;
        int cfr_ignored_0 = 5 << 3;
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ 5;
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

    public /* synthetic */ double E(long a2, int a3) {
        me_1 a4;
        me_1 me_12 = a4;
        me_12.M = me_12.E(a2) + (double)a3;
        return me_12.M;
    }

    public /* synthetic */ void E(int a2) {
        me_1 a3;
        me_1 me_12 = a3;
        a3.M = 0.0;
        me_12.c = 0L;
        me_12.b = (double)a2 / Math.log(2.0);
    }

    public /* synthetic */ double E(long a2) {
        me_1 a3;
        me_1 me_12 = a3;
        me_12.M *= Math.exp((double)(a3.c - a2) / a3.b);
        me_12.c = a2;
        return me_12.M;
    }

    public /* synthetic */ double E(long a2, double a3) {
        me_1 a4;
        me_1 me_12 = a4;
        me_12.M = me_12.E(a2) + a3;
        return me_12.M;
    }

    public /* synthetic */ me_1() {
        me_1 a2;
        me_1 me_12 = a2;
        a2.M = 0.0;
        me_12.c = 0L;
        me_12.b = 1.0;
    }
}

