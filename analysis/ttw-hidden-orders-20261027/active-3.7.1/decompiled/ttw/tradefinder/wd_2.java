/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.wd
 */
public class wd_2 {
    public final boolean D;
    public final double A;
    public final long C;
    public final float M;
    public final int b;
    public final long c;

    public /* synthetic */ wd_2(long a2, boolean a3, double a4, double a5, int a6, long a7) {
        wd_2 a8;
        wd_2 wd_22 = a8;
        wd_2 wd_23 = a8;
        wd_2 wd_24 = a8;
        wd_24.c = a2;
        wd_24.D = a3;
        wd_23.A = a5;
        wd_23.b = a6;
        wd_22.C = a7;
        wd_22.M = (float)(a5 / a4);
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (2 ^ 5) << 4 ^ 1;
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ (2 ^ 5);
        int n5 = n3;
        int n6 = (3 ^ 5) << 3 ^ 4;
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

