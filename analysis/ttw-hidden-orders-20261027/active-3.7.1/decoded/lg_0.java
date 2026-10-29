/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.fg_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.kd_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.xB;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Lg
 */
public class lg_0 {
    public int K;
    public int E;
    public int j;
    public int a;
    public long h;
    public int H;
    public final boolean D;
    private long A;
    public final boolean C;
    public String M;
    public long b;
    public int c;

    public /* synthetic */ void j(long a2, int a3, int a4) {
        lg_0 a5;
        lg_0 lg_02 = a5;
        lg_02.E += a3;
        lg_02.A += (long)(a3 * a4);
        a5.h = a2;
        a5.c = a4;
        a5.K = Math.min(a5.K, a4);
        a5.H = Math.max(a5.H, a4);
    }

    public /* synthetic */ String E(ze_2 a2) {
        lg_0 a3;
        String string = a3.D ? "SELL" : "BUY";
        return String.format("SWEEP %s, V: %s, P: %s at %s", string, a2.E(a3.j()), Integer.toString(a3.a()), a2.j((int)((double)a3.c + 0.1)));
    }

    public /* synthetic */ Map<String, String> E(ze_2 a2) {
        lg_0 a3;
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put("Price Change", Integer.toString(a3.a()));
        hashMap.put("Volume", a2.E(a3.j()));
        if (a3.j != 0) {
            hashMap.put("Active Volume", a2.E(a3.E));
            hashMap.put("Passive Volume", a2.E(a3.j));
        }
        HashMap<String, String> hashMap2 = hashMap;
        hashMap2.put("Price", a2.j((int)((double)a3.c + 0.1)));
        return hashMap2;
    }

    public /* synthetic */ lg_0(lg_0 a2) {
        lg_0 a3;
        lg_0 lg_02 = a3;
        lg_0 lg_03 = a2;
        lg_0 lg_04 = a3;
        lg_0 lg_05 = a2;
        lg_0 lg_06 = a3;
        lg_0 lg_07 = a2;
        lg_0 lg_08 = a3;
        lg_0 lg_09 = a2;
        lg_0 lg_010 = a3;
        lg_0 lg_011 = a3;
        lg_0 lg_012 = a3;
        lg_0 lg_013 = a3;
        a3.E = 0;
        lg_013.b = 0L;
        lg_013.h = 0L;
        lg_012.a = 0;
        lg_012.c = 0;
        lg_011.K = 0;
        lg_011.H = 0;
        lg_010.j = 0;
        lg_010.A = 0L;
        a3.D = lg_09.D;
        lg_08.C = lg_09.C;
        lg_08.M = a2.M;
        a3.E = lg_07.E;
        lg_06.b = lg_07.b;
        lg_06.h = a2.h;
        a3.a = lg_05.a;
        lg_04.c = lg_05.c;
        lg_04.K = a2.K;
        a3.H = lg_03.H;
        lg_02.j = lg_03.j;
        lg_02.A = a2.A;
    }

    public /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3) {
        lg_0 a4;
        String string = a4.D ? "Sell Sweep" : "Buy Sweep";
        return a3.E(a2.D, string, a2.E(a4.j()), a2.j((int)((double)a4.c + 0.1)), a4.D);
    }

    public /* synthetic */ void E(long a2, int a3, int a4) {
        lg_0 a5;
        lg_0 lg_02 = a5;
        lg_02.j += a3;
        lg_02.A += (long)(a3 * a4);
        a5.h = a2;
        a5.c = a4;
        a5.K = Math.min(a5.K, a4);
        a5.H = Math.max(a5.H, a4);
    }

    public /* synthetic */ long E() {
        lg_0 a2;
        return a2.h - a2.b;
    }

    public /* synthetic */ int a() {
        lg_0 a2;
        lg_0 lg_02 = a2;
        return Math.abs(lg_02.H - lg_02.K) + 1;
    }

    public /* synthetic */ cc_0 E(ze_2 a2, boolean a32) {
        String string;
        double d2;
        lg_0 a4;
        Object object = a4.D ? "Sell Sweep" : "Buy Sweep";
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("R:", new ec_0(Integer.toString(a4.a()))));
        if (a4.j != 0) {
            arrayList.add(new eb_0("A:", new ec_0(a2.E(a4.E))));
            arrayList.add(new eb_0("P:", new ec_0(a2.E(a4.j))));
        }
        if (a32) {
            arrayList.add(new eb_0("ID:", new ec_0(a4.M)));
        }
        ze_2 ze_22 = a2;
        double d3 = ze_22.E(a4.j());
        String a32 = ze_22.E(d3);
        Color color = null;
        if (a4.C) {
            color = he_1.A;
            object = (String)object + "-S";
        }
        String string2 = a2.j(a4.c);
        if (a4.D) {
            d2 = -d3;
            string = a32;
        } else {
            d2 = d3;
            string = a32;
        }
        return new cc_0((String)object, string2, af_0.j, new xB(d2, string), arrayList, color);
    }

    public /* synthetic */ int j() {
        lg_0 a2;
        lg_0 lg_02 = a2;
        return lg_02.E + lg_02.j;
    }

    public /* synthetic */ lg_0(String a2, int a3, int a4, boolean a5, boolean a6, long a7) {
        lg_0 a8;
        lg_0 lg_02 = a8;
        lg_0 lg_03 = a8;
        lg_0 lg_04 = a8;
        lg_0 lg_05 = a8;
        lg_0 lg_06 = a8;
        lg_0 lg_07 = a8;
        lg_0 lg_08 = a8;
        a8.E = 0;
        lg_08.b = 0L;
        lg_08.h = 0L;
        lg_07.a = 0;
        lg_07.c = 0;
        lg_06.K = 0;
        lg_06.H = 0;
        lg_05.j = 0;
        lg_05.A = 0L;
        lg_04.M = a2;
        lg_04.D = a5;
        lg_03.C = a6;
        lg_03.E = a3;
        lg_02.h = a8.b = a7;
        lg_02.a = a4;
        a8.K = a8.c = a4;
        a8.H = a4;
        a8.A += (long)(a3 * a4);
    }

    public /* synthetic */ int E() {
        lg_0 a2;
        return (int)Math.round((double)a2.A / (double)a2.j());
    }
}

