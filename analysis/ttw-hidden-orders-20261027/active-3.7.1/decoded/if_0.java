/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.d_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.lD;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.xB;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.if
 */
public class if_0 {
    public static /* synthetic */ cc_0 E(ze_2 a2, long a32, int a42, int a5, double a6, int a7, long a8, boolean a9) {
        Object object;
        double d2;
        String a32 = a9 ? "Sell Stop Run" : "Buy Stop Run";
        ze_2 ze_22 = a2;
        String string = ze_22.j(a42);
        a2 = ze_22.E(a6);
        ArrayList<eb_0> a42 = new ArrayList<eb_0>();
        a42.add(new eb_0("R:", new ec_0(String.valueOf(a5))));
        a42.add(new eb_0("#:", new ec_0(String.valueOf(a7))));
        a42.add(new eb_0("T:", new ec_0(String.valueOf(a8) + " ms")));
        if (a9) {
            d2 = -a6;
            object = a2;
        } else {
            d2 = a6;
            object = a2;
        }
        a2 = new xB(d2, (String)object);
        return new cc_0(a32, string, af_0.b, (d_0)a2, a42, null);
    }

    public static /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3, int a4, double a5, boolean a6) {
        String string = a6 ? "Sell Stop Run" : "Buy StopRun";
        return a3.E(a2.D, string, a2.E(a5), a2.j(a4), a6);
    }

    public static /* synthetic */ String E(ze_2 a2, int a3, int a4, double a5, int a6, long a7, boolean a82) {
        String a82 = a82 ? "SELL" : "BUY";
        return String.format("%s STOP RUN, V: %s, R: %s, #: %s, T: %s at %s", a82, a2.E(a5), String.valueOf(a4), String.valueOf(a6), String.valueOf(a7) + " ms", a2.j(a3));
    }

    public /* synthetic */ if_0() {
        if_0 a2;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 5;
        int cfr_ignored_0 = 5 << 3 ^ 4;
        int n5 = n3;
        int n6 = 3 << 3 ^ 3;
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

    public static /* synthetic */ Map<String, String> E(ze_2 a2, int a3, int a4, double a5, int a6, long a7, boolean a82) {
        HashMap<String, String> a82 = new HashMap<String, String>();
        a82.put("Volume", a2.E(a5));
        a82.put("Price Range", String.valueOf(a4));
        a82.put("Order Count", String.valueOf(a6));
        a82.put("Duration", String.valueOf(a7) + " ms");
        a82.put("Price", a2.j(a3));
        return a82;
    }
}

