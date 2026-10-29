/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.HashMap;
import java.util.Map;
import java.util.StringJoiner;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.ee;
import ttw.tradefinder.fe_1;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.ke_1;
import ttw.tradefinder.tf_2;
import ttw.tradefinder.wa_2;
import ttw.tradefinder.wd_1;

/*
 * Renamed from ttw.tradefinder.bg
 */
public class bg_0 {
    private ke_1 b = new ke_1();
    private static final String c = "     ";

    public void j(String a2, String a3, String a4) {
        bg_0 a5;
        Object object = new HashMap<String, String>();
        object.put("Price", "4185.9");
        object.put("Volume", "9999.9");
        StringJoiner stringJoiner = new StringJoiner(System.lineSeparator());
        bg_0 bg_02 = a5;
        bg_02.E(hg_0.d, stringJoiner);
        bg_02.E(hg_0.h, stringJoiner);
        bg_02.E(hg_0.c, stringJoiner);
        bg_02.E(hg_0.j, stringJoiner);
        bg_02.E(hg_0.D, stringJoiner);
        bg_02.E(hg_0.C, stringJoiner);
        bg_02.E(hg_0.A, stringJoiner);
        bg_02.E(hg_0.e, stringJoiner);
        bg_02.E(hg_0.B, stringJoiner);
        bg_02.E(hg_0.H, stringJoiner);
        bg_02.E(hg_0.i, stringJoiner);
        bg_02.E(hg_0.a, stringJoiner);
        bg_02.E(hg_0.E, stringJoiner);
        bg_02.E(hg_0.b, stringJoiner);
        bg_02.E(hg_0.M, stringJoiner);
        bg_02.E(hg_0.k, stringJoiner);
        bg_02.E(hg_0.K, stringJoiner);
        stringJoiner.add(String.format("%s*%s*: %s", "     ", "Instrument", ((String)a2).split("@")[0]));
        a2 = object.entrySet().iterator();
        Object object2 = a2;
        while (object2.hasNext()) {
            object = (Map.Entry)a2.next();
            stringJoiner.add(String.format("%s*%s*: %s", "     ", object.getKey(), object.getValue()));
            object2 = a2;
        }
        a5.b.j(new tf_2(a3, a4, stringJoiner.toString()));
    }

    private /* synthetic */ String E(hg_0 a2) {
        switch (a2) {
            case j: 
            case D: 
            case A: {
                while (false) {
                }
                return "Direction";
            }
        }
        return "Side";
    }

    public void E(hg_0 a2, bf_2 a3, String a4, String a5, String a6, Map<String, String> a7) {
        bg_0 a8;
        StringJoiner stringJoiner = new StringJoiner(System.lineSeparator());
        stringJoiner.add(a8.j((hg_0)((Object)a2), (bf_2)((Object)a3)));
        stringJoiner.add(String.format("%s*%s*: %s", "     ", "Instrument", a4.split("@")[0]));
        stringJoiner.add(String.format("%s*%s*: %s", "     ", a8.E((hg_0)((Object)a2)), a8.E((hg_0)((Object)a2), (bf_2)((Object)a3))));
        a2 = a7.entrySet().iterator();
        Object object = a2;
        while (object.hasNext()) {
            a3 = (Map.Entry)a2.next();
            stringJoiner.add(String.format("%s*%s*: %s", "     ", a3.getKey(), a3.getValue()));
            object = a2;
        }
        a8.b.j(new tf_2(a5, a6, stringJoiner.toString()));
    }

    public void E(String a2, String a3, String a4) {
        bg_0 a5;
        StringJoiner stringJoiner = new StringJoiner(" ");
        stringJoiner.add(ee.E(fe_1.C));
        stringJoiner.add(a2);
        stringJoiner.add("is running and ready to send signals.");
        a5.b.j(new tf_2(a3, a4, stringJoiner.toString()));
    }

    /*
     * Enabled aggressive block sorting
     */
    private /* synthetic */ String j(hg_0 a2, bf_2 a3) {
        StringJoiner stringJoiner;
        StringJoiner stringJoiner2 = new StringJoiner(" ");
        switch (a2) {
            case d: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add("TTW LIQUIDITY");
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case h: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add("TTW LIQUIDITY");
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner2.add(ee.E(fe_1.M));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case c: {
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add("TTW LIQUIDITY");
                stringJoiner2.add(ee.E(fe_1.c));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner2.add(ee.E(fe_1.G));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case j: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add("TTW IMBALANCE");
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.l));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case D: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add("TTW IMBALANCE");
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.J));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case C: {
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add("TTW IMBALANCE ZERO-CROSS");
                stringJoiner2.add(ee.E(fe_1.k));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case A: {
                stringJoiner2.add(ee.E(fe_1.F));
                stringJoiner2.add("TTW VOLUME SPIKE");
                stringJoiner2.add(ee.E(fe_1.F));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case e: {
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add("TTW HIDDEN ORDER");
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case B: {
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add("TTW ICEBERG DEVELOPMENT");
                stringJoiner2.add(ee.E(fe_1.H));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.e : fe_1.m));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case H: {
                stringJoiner2.add(ee.E(fe_1.K));
                stringJoiner2.add("TTW SWEEP");
                stringJoiner2.add(ee.E(fe_1.K));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case i: {
                stringJoiner2.add(ee.E(fe_1.j));
                stringJoiner2.add("TTW ABSORPTION");
                stringJoiner2.add(ee.E(fe_1.j));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case a: {
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.f : fe_1.B));
                stringJoiner2.add("TTW PRICE ALERT");
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.f : fe_1.B));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case E: {
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add("TTW V-DELTA");
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case b: {
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner2.add("TTW V-DELTA ZERO-CROSS");
                stringJoiner2.add(ee.E(fe_1.d));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case M: {
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add("TTW MARKET VOLUME STOP");
                stringJoiner2.add(ee.E(fe_1.i));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
            }
            case k: {
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add("TTW VOLUME STOP");
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
                stringJoiner = stringJoiner2;
                return stringJoiner.toString();
            }
            case K: {
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add("TTW STOP RUN");
                stringJoiner2.add(ee.E(fe_1.D));
                stringJoiner2.add(ee.E(a3 == bf_2.c ? fe_1.m : fe_1.e));
            }
        }
        stringJoiner = stringJoiner2;
        return stringJoiner.toString();
    }

    public void E(String a2, String a3) {
        bg_0 a4;
        StringJoiner stringJoiner = new StringJoiner(" ");
        stringJoiner.add("*Congrats, you did it!*");
        stringJoiner.add(ee.E(fe_1.b));
        stringJoiner.add("Your *TTW Alerts Bot* is up and running - we wish you profitable trades!");
        stringJoiner.add(ee.E(fe_1.A));
        a4.b.j(new tf_2(a2, a3, stringJoiner.toString()));
    }

    /*
     * Enabled aggressive block sorting
     */
    private /* synthetic */ String E(hg_0 a2, bf_2 a3) {
        switch (a2) {
            case j: {
                return ee.E(fe_1.l);
            }
            case D: {
                return ee.E(fe_1.J);
            }
            case A: 
            case M: 
            case k: 
            case K: {
                switch (a3) {
                    case c: {
                        return "BUY";
                    }
                }
                return "SELL";
            }
        }
        switch (a3) {
            case c: {
                return "ASK";
            }
        }
        return "BID";
    }

    public void j() {
        bg_0 a2;
        a2.b.j();
    }

    private /* synthetic */ void E(hg_0 a2, StringJoiner a3) {
        bg_0 a4;
        StringJoiner stringJoiner = a3;
        stringJoiner.add(a4.j(a2, bf_2.c));
        stringJoiner.add(String.format("%s*%s*: %s", "     ", a4.E(a2), a4.E(a2, bf_2.c)));
        a3.add(a4.j(a2, bf_2.b));
        a3.add(String.format("%s*%s*: %s", "     ", a4.E(a2), a4.E(a2, bf_2.b)));
    }

    public bg_0() {
        bg_0 a2;
    }

    public void E() {
        bg_0 a2;
        a2.b.E();
    }
}

