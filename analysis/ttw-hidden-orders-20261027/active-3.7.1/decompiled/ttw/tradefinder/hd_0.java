/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

/*
 * Renamed from ttw.tradefinder.Hd
 */
public class hd_0 {
    private boolean LicenseValid;

    public /* synthetic */ boolean E() {
        hd_0 a2;
        return a2.LicenseValid;
    }

    public /* synthetic */ hd_0() {
        hd_0 a2;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 3 ^ 1;
        int cfr_ignored_0 = 1 << 3 ^ 3;
        int n5 = n3;
        int n6 = 2 << 3 ^ (2 ^ 5);
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

    public /* synthetic */ void E(boolean a2) {
        a.LicenseValid = a2;
    }
}

