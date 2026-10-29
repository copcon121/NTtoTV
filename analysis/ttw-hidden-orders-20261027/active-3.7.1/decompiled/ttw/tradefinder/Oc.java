/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Collections;
import ttw.tradefinder.EB;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.ec_0;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.vC;
import ttw.tradefinder.xB;

public class Oc {
    public static cc_0 C() {
        return new cc_0(gb_1.E("-(\u0001%\u0000/E\u0003\f%"), Oc.E("U\rW\u0003"), af_0.h, new xB(1576.0, gb_1.E("TtRw")), Collections.emptyList(), null);
    }

    public static cc_0 g() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(Oc.E("4\u000f"), new ec_0(Integer.toString(4))));
        return new cc_0(gb_1.E("6$\t-E\u0012\u0012$\u00001"), Oc.E("\u0004\\\u0006R\u001bV\u0000"), af_0.j, new xB(-576.0, gb_1.E("tRw")), arrayList, null);
    }

    public static cc_0 f() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(gb_1.E("7{"), new ec_0(Oc.E("\u0003"))));
        arrayList.add(new eb_0(gb_1.E("F{"), new ec_0(Oc.E("V\u0004"))));
        arrayList.add(new eb_0(gb_1.E("1{"), new ec_0(Oc.E("\u0004\\\u0015\tF"))));
        return new cc_0(gb_1.E("\u0012\u0000-\ta65\n1E\u0013\u0010/"), Oc.E("\u0004\\\u0006R\u001bV\u0000"), af_0.b, new xB(-81.0, gb_1.E("]p")), arrayList, null);
    }

    public static cc_0 l() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(Oc.E("4\u000f"), new ec_0(Integer.toString(4))));
        return new cc_0(gb_1.E("\u0003\u00108E\u0012\u0012$\u00001"), Oc.E("\u0004\\\u0006R\u001bV\u0000"), af_0.j, new xB(576.0, gb_1.E("tRw")), arrayList, null);
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 2 << 1;
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ 5 << 1;
        int n5 = n3;
        int n6 = (3 ^ 5) << 3 ^ 5;
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

    public static cc_0 H() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(Oc.E("4\u000f"), new ec_0(Integer.toString(8))));
        arrayList.add(new eb_0(gb_1.E("7{"), new vC(3.9)));
        return new cc_0(Oc.E("7P\bYDcIf\u0014\\\u000fP"), gb_1.E("p]rSoWt"), af_0.K, new EB(Oc.E("V\u0000T\u0007"), gb_1.E("wVy")), arrayList, null);
    }

    public Oc() {
        Oc a2;
    }

    public static cc_0 A() {
        return new cc_0(gb_1.E("\u0012\u0000-\ta$#\u0016.\u00171\u0011(\n/"), Oc.E("\u0004\\\u0006R\u001bV\u0000"), af_0.H, new xB(-576.0, gb_1.E("tRw")), Collections.emptyList(), null);
    }

    public static cc_0 d() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(Oc.E("4\u000f"), new ec_0(Integer.toString(8))));
        arrayList.add(new eb_0(gb_1.E("7{"), new vC(3.9)));
        return new cc_0(Oc.E("w\u0011LDcIf\u0014\\\u000fP"), gb_1.E("p]rSoWt"), af_0.K, new EB(Oc.E("\u0003W\r"), gb_1.E("WtUs")), arrayList, null);
    }

    public static cc_0 a() {
        return new cc_0(Oc.E(",\\\u0000Q\u0001[Dt\u0017^"), gb_1.E("TyVw"), af_0.h, new xB(-1576.0, Oc.E("U\u0000S\u0003")), Collections.emptyList(), null);
    }

    public static cc_0 j() {
        return new cc_0(Oc.E("&@\u001d\u0015%W\u0017Z\u0016E\u0010\\\u000b["), gb_1.E("p]rSoWt"), af_0.H, new xB(576.0, Oc.E("\u0000S\u0003")), Collections.emptyList(), null);
    }

    public static cc_0 E() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0(Oc.E("6\u000f"), new ec_0(gb_1.E("w"))));
        arrayList.add(new eb_0(Oc.E("G\u000f"), new ec_0(gb_1.E("Wp"))));
        arrayList.add(new eb_0(Oc.E("0\u000f"), new ec_0(gb_1.E("p]a\b2"))));
        return new cc_0(Oc.E("&@\u001d\u00157A\u000bEDg\u0011["), gb_1.E("p]rSoWt"), af_0.b, new xB(81.0, Oc.E("\\\u0004")), arrayList, null);
    }
}

