/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import ttw.tradefinder.af_0;
import ttw.tradefinder.d_0;
import ttw.tradefinder.eb_0;
import ttw.tradefinder.m_0;
import ttw.tradefinder.mb;
import ttw.tradefinder.ub;

/*
 * Renamed from ttw.tradefinder.Cc
 */
public class cc_0 {
    private final Color D;
    private final String A;
    private final String C;
    private final d_0 M;
    private final List<eb_0> b;
    private final af_0 c;

    public af_0 ttw_tradefinder_af_0_E() {
        cc_0 a2;
        return a2.c;
    }

    public cc_0(String a2, String a3, af_0 a4, d_0 a5, List<eb_0> a6, Color a7) {
        cc_0 a8;
        cc_0 cc_02 = a8;
        cc_0 cc_03 = a8;
        cc_0 cc_04 = a8;
        cc_04.A = a2;
        cc_04.C = a3;
        cc_03.c = a4;
        cc_03.M = a5;
        cc_02.b = a6;
        cc_02.D = a7;
    }

    public ub ttw_tradefinder_ub_E() {
        cc_0 a2;
        cc_0 cc_02 = a2;
        return new ub(cc_02.A, cc_02.C, a2.c, a2.ttw_tradefinder_m_0_E(), a2.E(), a2.D);
    }

    private /* synthetic */ m_0 ttw_tradefinder_m_0_E() {
        cc_0 a2;
        if (a2.M == null) {
            return null;
        }
        return a2.M.E();
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 3 ^ 2;
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ (3 << 2 ^ 3);
        int n5 = n3;
        int n6 = 5 << 4 ^ 2 << 1;
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

    private /* synthetic */ List<mb> E() {
        Iterator<eb_0> iterator;
        cc_0 a2;
        if (a2.b.isEmpty()) {
            return new ArrayList<mb>();
        }
        ArrayList<mb> arrayList = new ArrayList<mb>();
        Iterator<eb_0> iterator2 = iterator = a2.b.iterator();
        while (iterator2.hasNext()) {
            eb_0 eb_02 = iterator.next();
            iterator2 = iterator;
            arrayList.add(eb_02.ttw_tradefinder_mb_E());
        }
        return arrayList;
    }
}

