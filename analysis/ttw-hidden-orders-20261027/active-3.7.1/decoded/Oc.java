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
        return new cc_0("Hidden Bid", "1836", af_0.h, new xB(1576.0, "1576"), Collections.emptyList(), null);
    }

    public static cc_0 g() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("P:", new ec_0(Integer.toString(4))));
        return new cc_0("Sell Sweep", "1836.25", af_0.j, new xB(-576.0, "576"), arrayList, null);
    }

    public static cc_0 f() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("R:", new ec_0("6")));
        arrayList.add(new eb_0("#:", new ec_0("21")));
        arrayList.add(new eb_0("T:", new ec_0("18 ms")));
        return new cc_0("Sell Stop Run", "1836.25", af_0.b, new xB(-81.0, "81"), arrayList, null);
    }

    public static cc_0 l() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("P:", new ec_0(Integer.toString(4))));
        return new cc_0("Buy Sweep", "1836.25", af_0.j, new xB(576.0, "576"), arrayList, null);
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
        arrayList.add(new eb_0("P:", new ec_0(Integer.toString(8))));
        arrayList.add(new eb_0("R:", new vC(3.9)));
        return new cc_0("Sell V-Spike", "1836.25", af_0.K, new EB("2502", "638"), arrayList, null);
    }

    public Oc() {
        Oc a2;
    }

    public static cc_0 A() {
        return new cc_0("Sell Absorption", "1836.25", af_0.H, new xB(-576.0, "576"), Collections.emptyList(), null);
    }

    public static cc_0 d() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("P:", new ec_0(Integer.toString(8))));
        arrayList.add(new eb_0("R:", new vC(3.9)));
        return new cc_0("Buy V-Spike", "1836.25", af_0.K, new EB("638", "2502"), arrayList, null);
    }

    public static cc_0 a() {
        return new cc_0("Hidden Ask", "1836", af_0.h, new xB(-1576.0, "1576"), Collections.emptyList(), null);
    }

    public static cc_0 j() {
        return new cc_0("Buy Absorption", "1836.25", af_0.H, new xB(576.0, "576"), Collections.emptyList(), null);
    }

    public static cc_0 E() {
        ArrayList<eb_0> arrayList = new ArrayList<eb_0>();
        arrayList.add(new eb_0("R:", new ec_0("6")));
        arrayList.add(new eb_0("#:", new ec_0("21")));
        arrayList.add(new eb_0("T:", new ec_0("18 ms")));
        return new cc_0("Buy Stop Run", "1836.25", af_0.b, new xB(81.0, "81"), arrayList, null);
    }
}

