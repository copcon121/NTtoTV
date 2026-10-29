/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.EB;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.ff_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.he_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.qe_0;
import ttw.tradefinder.te_0;
import ttw.tradefinder.vC;
import ttw.tradefinder.ze_2;

public class Tf {
    private static final DecimalFormat c = new DecimalFormat("#.#");

    public static /* synthetic */ String E(ze_2 a2, qe_0 a3) {
        String string = a3.E() ? "SELL" : "BUY";
        return String.format("VOLUME SPIKE %s, V: %s/%s, P: %s, R: %s at %s", string, a2.E(a3.a()), a2.E(a3.j()), Integer.toString(a3.j()), c.format(a3.E()), a2.j(a3.E()));
    }

    public static /* synthetic */ Map<String, String> E(ze_2 a2, qe_0 a3) {
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put("Price Change", Integer.toString(a3.j()));
        hashMap.put("Volume", a2.E(a3.a()) + " sell, " + a2.E(a3.j()) + " buy");
        hashMap.put("Ratio", c.format(a3.E()));
        hashMap.put("Price", a2.j(a3.E()));
        return hashMap;
    }

    public static /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3, qe_0 a4) {
        String string = a4.E() ? "Sell Volume Spike" : "Buy Volume Spike";
        qe_0 qe_02 = a4;
        String string2 = a2.E(a4.E() ? qe_02.a() : qe_02.j());
        return a3.E(a2.D, string, string2, a2.j(a4.E()), a4.E());
    }

    public static /* synthetic */ cc_0 E(ze_2 a2, qe_0 a3) {
        String string = a3.E() ? "Sell V-Spike" : "Buy V-Spike";
        double d2 = a3.E();
        Color color = d2 == Double.POSITIVE_INFINITY || d2 == Double.NEGATIVE_INFINITY ? he_1.A : null;
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("P:", new ec_0(Integer.toString(a3.j()))));
        arrayList.add(new eb_0("R:", new vC(d2)));
        return new cc_0(string, a2.j(a3.E()), af_0.K, new EB(a2.E(a3.j()), a2.E(a3.a())), arrayList, color);
    }

    public /* synthetic */ Tf() {
        Tf a2;
    }
}

