/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.af_0;
import ttw.tradefinder.bE;
import ttw.tradefinder.be_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.gf_2;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.ra_1;
import ttw.tradefinder.sf_0;
import ttw.tradefinder.xB;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.nD
 */
public class nd_2 {
    public double h;
    public int H;
    private boolean D;
    private final boolean A;
    private final int C;
    private bE M;
    private final Object b;
    public long c;

    public /* synthetic */ Map<String, String> E(ze_2 a2) {
        nd_2 a3;
        HashMap<String, String> hashMap = new HashMap<String, String>();
        hashMap.put(ra_1.E("\u0004\u001b>\u0001?\u0011"), a2.java_lang_String_E(a3.h));
        hashMap.put(sf_0.E("4\u0004\r\u0015\u0001"), a2.java_lang_String_j(a3.H));
        return hashMap;
    }

    public /* synthetic */ String java_lang_String_E(ze_2 a2) {
        nd_2 a3;
        String string = a3.A ? ra_1.E("\u00011\u001e8") : sf_0.E("&#=");
        return String.format(ra_1.E("\u00136\u0001;\u0000$\u0006=\u001d:rQ!Xr\"hTw\u0007r\u0015&Tw\u0007"), string, a2.java_lang_String_E(a3.h), a2.java_lang_String_j(a3.H));
    }

    public /* synthetic */ qd_2 E(ze_2 a2, gf_2 a3) {
        nd_2 a4;
        String string = a4.A ? sf_0.E("7\u0013\b\u001aD7\u0006\u0005\u000b\u0004\u0014\u0002\r\u0019\n") : ra_1.E("\u0010\u0001+T\u0013\u0016!\u001b \u0004&\u001d=\u001a");
        return a3.E(a2.D, string, a2.java_lang_String_E(a4.h), a2.java_lang_String_j(a4.H), a4.A);
    }

    public /* synthetic */ nd_2(boolean a2, int a3) {
        nd_2 a4;
        nd_2 nd_22 = a4;
        nd_2 nd_23 = a4;
        nd_2 nd_24 = a4;
        a4.b = new Object();
        a4.M = new bE();
        nd_24.D = false;
        nd_24.H = 0;
        nd_23.c = 0L;
        nd_23.h = 0.0;
        nd_22.A = a2;
        nd_22.C = a3;
    }

    public /* synthetic */ void E(long a2, int a3, double a4) {
        nd_2 a5;
        Object object = a5.b;
        synchronized (object) {
            a5.M.E(a2, a3, a4);
            return;
        }
    }

    public /* synthetic */ cc_0 ttw_tradefinder_cc_0_E(ze_2 a2) {
        ze_2 ze_22;
        double d2;
        nd_2 a3;
        String string = a3.A ? ra_1.E("'7\u0018>T\u0013\u0016!\u001b \u0004&\u001d=\u001a") : sf_0.E("4\u0011\u000fD7\u0006\u0005\u000b\u0004\u0014\u0002\r\u0019\n");
        String string2 = a2.java_lang_String_j(a3.H);
        nd_2 nd_22 = a3;
        if (a3.A) {
            d2 = -nd_22.h;
            ze_22 = a2;
        } else {
            d2 = nd_22.h;
            ze_22 = a2;
        }
        return new cc_0(string, string2, af_0.H, new xB(d2, ze_22.java_lang_String_E(a3.h)), Collections.emptyList(), null);
    }

    public /* synthetic */ boolean E(long a22, double a3) {
        Map.Entry a22;
        nd_2 a4;
        double d2 = 0.0;
        int n2 = Integer.MAX_VALUE;
        int n3 = Integer.MIN_VALUE;
        Object object = a4.b;
        synchronized (object) {
            Iterator iterator;
            if (a4.M.isEmpty()) {
                return false;
            }
            nd_2 nd_22 = a4;
            nd_22.M.headMap(a22).clear();
            a22 = nd_22.M.lastEntry();
            Iterator iterator2 = iterator = nd_22.M.values().iterator();
            while (iterator2.hasNext()) {
                be_0 be_02 = (be_0)iterator.next();
                d2 += be_02.c;
                n2 = Math.min(n2, be_02.b);
                n3 = Math.max(n3, be_02.b);
                iterator2 = iterator;
            }
        }
        int n4 = Math.abs(n3 - n2);
        if (a4.D) {
            if (d2 > a4.h && n4 < a4.C) {
                nd_2 nd_23 = a4;
                nd_23.h = d2;
                nd_23.c = (Long)a22.getKey();
                a4.H = ((be_0)a22.getValue()).b;
            }
            if (d2 < 0.9 * a4.h || n4 >= a4.C) {
                return true;
            }
        } else if (d2 >= a3 && n4 < a4.C) {
            nd_2 nd_24 = a4;
            nd_24.D = true;
            nd_24.H = ((be_0)a22.getValue()).b;
            a4.c = (Long)a22.getKey();
            a4.h = d2;
        }
        return false;
    }

    public static /* synthetic */ String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 3 ^ 2;
        int cfr_ignored_0 = 4 << 4 ^ (3 << 2 ^ 3);
        int n5 = n3;
        int n6 = (2 ^ 5) << 3 ^ 1;
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

    public /* synthetic */ void E() {
        nd_2 a2;
        Object object = a2.b;
        synchronized (object) {
            a2.M.clear();
        }
        a2.D = false;
        nd_2 nd_22 = a2;
        a2.H = 0;
        nd_22.c = 0L;
        nd_22.h = 0.0;
    }
}

