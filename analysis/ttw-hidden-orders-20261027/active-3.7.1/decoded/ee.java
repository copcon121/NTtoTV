/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import ttw.tradefinder.Ad;
import ttw.tradefinder.Ic;
import ttw.tradefinder.ae_2;
import ttw.tradefinder.cC;
import ttw.tradefinder.db_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.fe_1;
import ttw.tradefinder.hd;
import ttw.tradefinder.ja_0;
import ttw.tradefinder.kc_1;
import ttw.tradefinder.la_1;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.mb_2;
import ttw.tradefinder.qc_0;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.uc_2;
import ttw.tradefinder.wB;
import ttw.tradefinder.wd_2;
import ttw.tradefinder.xa_1;
import ttw.tradefinder.yb_0;
import ttw.tradefinder.za_1;

public class ee {
    private static final Map<wB, String> I;
    private static final Map<hd, String> f;
    private static final Map<za_1, String> F;
    private static final Map<cC, String> J;
    private static final Map<la_1, String> G;
    private static final Map<xa_1, String> d;
    private static final Map<eC, String> i;
    private static final Map<eb_1, String> e;
    private static final Map<rd_2, String> k;
    private static final Map<yb_0, String> B;
    private static final Map<Ad, String> K;
    private static final Map<lc_0, String> E;
    private static final Map<kc_1, String> j;
    private static final Map<Ic, String> a;
    private static final Map<ae_2, String> h;
    private static final Map<uc_2, String> H;
    private static final Map<ja_0, String> D;
    private static final Map<db_0, String> A;
    private static final Map<qc_0, String> C;
    private static final Map<fe_1, String> M;
    private static final Map<df_1, String> b;
    private static final Map<mb_2, String> c;

    public static /* synthetic */ Collection<String> E(ae_2 a2) {
        return h.values();
    }

    private static /* synthetic */ Map<eb_1, String> E(eb_1 a2) {
        a2 = new LinkedHashMap<eb_1, String>();
        a2.put(eb_1.M, "Solid");
        a2.put(eb_1.A, "Short Dash");
        a2.put(eb_1.D, "Long Dash");
        a2.put(eb_1.b, "Dash-Dot");
        a2.put(eb_1.C, "Dot");
        return a2;
    }

    public static /* synthetic */ String E(lc_0 a2) {
        if (!E.containsKey((Object)a2)) {
            return "---";
        }
        return E.get((Object)a2);
    }

    private static /* synthetic */ Map<eC, String> E(eC a2) {
        a2 = new LinkedHashMap<eC, String>();
        a2.put(eC.D, "ArrowUp");
        a2.put(eC.M, "ArrowDown");
        a2.put(eC.H, "Dot");
        a2.put(eC.c, "Square");
        a2.put(eC.C, "TriangleUp");
        a2.put(eC.b, "TriangleDown");
        a2.put(eC.A, "H-Bar");
        a2.put(eC.a, "V-Bar");
        return a2;
    }

    public static /* synthetic */ uc_2 E(String a2, uc_2 a3) {
        for (Map.Entry<uc_2, String> entry : H.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ qc_0 E(String a2, qc_0 a3) {
        for (Map.Entry<qc_0, String> entry : C.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(wB a2) {
        return I.values();
    }

    public static /* synthetic */ Collection<String> E(hd a2) {
        return f.values();
    }

    private static /* synthetic */ Map<xa_1, String> E(xa_1 a2) {
        a2 = new LinkedHashMap<xa_1, String>();
        a2.put(xa_1.b, "Arrow");
        a2.put(xa_1.C, "Triangle");
        a2.put(xa_1.A, "Flag");
        a2.put(xa_1.M, "ShortFlag");
        return a2;
    }

    private static /* synthetic */ Map<kc_1, String> E(kc_1 a2) {
        a2 = new LinkedHashMap<kc_1, String>();
        a2.put(kc_1.A, "Disabled");
        a2.put(kc_1.C, "TopLeft");
        a2.put(kc_1.b, "TopRight");
        a2.put(kc_1.D, "BottomLeft");
        a2.put(kc_1.M, "BottomRight");
        return a2;
    }

    public static /* synthetic */ mb_2 E(String a2, mb_2 a3) {
        for (Map.Entry<mb_2, String> entry : c.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ ae_2 E(String a2, ae_2 a3) {
        for (Map.Entry<ae_2, String> entry : h.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(la_1 a2) {
        return G.values();
    }

    public static /* synthetic */ hd E(String a2, hd a3) {
        for (Map.Entry<hd, String> entry : f.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    private static /* synthetic */ Map<ja_0, String> E(ja_0 a2) {
        a2 = new LinkedHashMap<ja_0, String>();
        a2.put(ja_0.b, "Horizontal");
        a2.put(ja_0.c, "Vertical");
        return a2;
    }

    public static /* synthetic */ Collection<String> E(rd_2 a2, boolean a3) {
        if (!a3) {
            return k.values();
        }
        a2 = k.values();
        a2.remove("NONE");
        return a2;
    }

    public static /* synthetic */ String E(fe_1 a2) {
        if (!M.containsKey((Object)a2)) {
            return "";
        }
        return M.get((Object)a2);
    }

    public static /* synthetic */ String E(yb_0 a2) {
        if (!B.containsKey((Object)a2)) {
            return "---";
        }
        return B.get((Object)a2);
    }

    public static /* synthetic */ String E(cC a2) {
        if (!J.containsKey((Object)a2)) {
            return "---";
        }
        return J.get((Object)a2);
    }

    public static /* synthetic */ Collection<String> E(yb_0 a2) {
        return B.values();
    }

    private static /* synthetic */ Map<Ad, String> E(Ad a2) {
        a2 = new LinkedHashMap<Ad, String>();
        a2.put(Ad.c, "ArrowUp");
        a2.put(Ad.C, "ArrowDown");
        a2.put(Ad.b, "Dot");
        a2.put(Ad.D, "Square");
        a2.put(Ad.h, "TriangleUp");
        a2.put(Ad.A, "TriangleDown");
        a2.put(Ad.H, "Line");
        return a2;
    }

    private static /* synthetic */ Map<Ic, String> E(Ic a2) {
        a2 = new LinkedHashMap<Ic, String>();
        a2.put(Ic.D, "VerySmall");
        a2.put(Ic.C, "Small");
        a2.put(Ic.b, "Medium");
        a2.put(Ic.H, "Large");
        a2.put(Ic.c, "VeryLarge");
        a2.put(Ic.A, "Variable");
        return a2;
    }

    public static /* synthetic */ String E(eb_1 a2) {
        if (!e.containsKey((Object)a2)) {
            return "---";
        }
        return e.get((Object)a2);
    }

    public static /* synthetic */ String E(Ic a2) {
        if (!a.containsKey((Object)a2)) {
            return "---";
        }
        return a.get((Object)a2);
    }

    public static /* synthetic */ String E(la_1 a2) {
        if (!G.containsKey((Object)a2)) {
            return "---";
        }
        return G.get((Object)a2);
    }

    private static /* synthetic */ Map<hd, String> E(hd a2) {
        a2 = new LinkedHashMap<hd, String>();
        a2.put(hd.c, "Small");
        a2.put(hd.M, "Medium");
        a2.put(hd.A, "Large");
        a2.put(hd.b, "Variable");
        return a2;
    }

    private static /* synthetic */ Map<yb_0, String> E(yb_0 a2) {
        a2 = new LinkedHashMap<yb_0, String>();
        a2.put(yb_0.M, "Separated");
        a2.put(yb_0.c, "Combined");
        return a2;
    }

    public static /* synthetic */ String E(eC a2) {
        if (!i.containsKey((Object)a2)) {
            return "---";
        }
        return i.get((Object)a2);
    }

    public static /* synthetic */ Collection<String> E(za_1 a2) {
        return F.values();
    }

    public static /* synthetic */ String E(uc_2 a2) {
        if (!H.containsKey((Object)a2)) {
            return "---";
        }
        return H.get((Object)a2);
    }

    public static /* synthetic */ String E(kc_1 a2) {
        if (!j.containsKey((Object)a2)) {
            return "---";
        }
        return j.get((Object)a2);
    }

    public static /* synthetic */ Collection<String> E(mb_2 a2) {
        return c.values();
    }

    public static /* synthetic */ String E(mb_2 a2) {
        if (!c.containsKey((Object)a2)) {
            return "---";
        }
        return c.get((Object)a2);
    }

    public static /* synthetic */ String E(hd a2) {
        if (!f.containsKey((Object)a2)) {
            return "---";
        }
        return f.get((Object)a2);
    }

    private static /* synthetic */ Map<mb_2, String> E(mb_2 a2) {
        a2 = new LinkedHashMap<mb_2, String>();
        a2.put(mb_2.b, "Compact");
        a2.put(mb_2.C, "Advanced");
        a2.put(mb_2.c, "Professional");
        return a2;
    }

    public static /* synthetic */ xa_1 E(String a2, xa_1 a3) {
        for (Map.Entry<xa_1, String> entry : d.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(Ic a2) {
        return a.values();
    }

    public static /* synthetic */ eb_1 E(String a2, eb_1 a3) {
        for (Map.Entry<eb_1, String> entry : e.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    private static /* synthetic */ Map<uc_2, String> E(uc_2 a2) {
        a2 = new LinkedHashMap<uc_2, String>();
        a2.put(uc_2.C, "Compact");
        a2.put(uc_2.M, "Advanced");
        a2.put(uc_2.b, "Professional");
        return a2;
    }

    public static /* synthetic */ lc_0 E(String a2, lc_0 a3) {
        for (Map.Entry<lc_0, String> entry : E.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ db_0 E(String a2, db_0 a3) {
        for (Map.Entry<db_0, String> entry : A.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    private static /* synthetic */ Map<qc_0, String> E(qc_0 a2) {
        a2 = new LinkedHashMap<qc_0, String>();
        a2.put(qc_0.C, "Dot");
        a2.put(qc_0.b, "Square");
        a2.put(qc_0.A, "Line");
        a2.put(qc_0.M, "Blend");
        return a2;
    }

    public static /* synthetic */ String E(ae_2 a2) {
        if (!h.containsKey((Object)a2)) {
            return "---";
        }
        return h.get((Object)a2);
    }

    public static /* synthetic */ String E(db_0 a2) {
        if (!A.containsKey((Object)a2)) {
            return "---";
        }
        return A.get((Object)a2);
    }

    public static /* synthetic */ eC E(String a2, eC a3) {
        for (Map.Entry<eC, String> entry : i.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ rd_2 E(String a2, rd_2 a3) {
        for (Map.Entry<rd_2, String> entry : k.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ String E(rd_2 a2) {
        if (!k.containsKey((Object)a2)) {
            return "---";
        }
        return k.get((Object)a2);
    }

    public static /* synthetic */ df_1 E(String a2, df_1 a3) {
        for (Map.Entry<df_1, String> entry : b.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    private static /* synthetic */ Map<df_1, String> E(df_1 a2) {
        a2 = new LinkedHashMap<df_1, String>();
        a2.put(df_1.c, "Enabled");
        a2.put(df_1.b, "Disabled");
        return a2;
    }

    private static /* synthetic */ Map<za_1, String> E(za_1 a2) {
        a2 = new LinkedHashMap<za_1, String>();
        a2.put(za_1.c, "Full");
        a2.put(za_1.M, "Variable");
        return a2;
    }

    private static /* synthetic */ Map<rd_2, String> E(rd_2 a2) {
        a2 = new LinkedHashMap<rd_2, String>();
        a2.put(rd_2.A, "Attention");
        a2.put(rd_2.C, "Notify");
        a2.put(rd_2.c, "PriceLevel");
        a2.put(rd_2.M, "Signal");
        a2.put(rd_2.D, "Confirm");
        a2.put(rd_2.H, "NONE");
        return a2;
    }

    public static /* synthetic */ String E(za_1 a2) {
        if (!F.containsKey((Object)a2)) {
            return "---";
        }
        return F.get((Object)a2);
    }

    public static /* synthetic */ kc_1 E(String a2, kc_1 a3) {
        for (Map.Entry<kc_1, String> entry : j.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(eb_1 a2) {
        return e.values();
    }

    public static /* synthetic */ Collection<String> E(eC a2) {
        return i.values();
    }

    private static /* synthetic */ Map<db_0, String> E(db_0 a2) {
        a2 = new LinkedHashMap<db_0, String>();
        a2.put(db_0.b, "Horizontal");
        a2.put(db_0.c, "Vertical");
        return a2;
    }

    public static /* synthetic */ Collection<String> E(cC a2) {
        return J.values();
    }

    static {
        M = ee.E(fe_1.I);
        k = ee.E(rd_2.H);
        h = ee.E(ae_2.c);
        b = ee.E(df_1.c);
        D = ee.E(ja_0.b);
        c = ee.E(mb_2.C);
        j = ee.E(kc_1.A);
        F = ee.E(za_1.c);
        f = ee.E(hd.c);
        K = ee.E(Ad.c);
        G = ee.E(la_1.c);
        A = ee.E(db_0.b);
        J = ee.E(cC.C);
        I = ee.E(wB.M);
        d = ee.E(xa_1.b);
        E = ee.E(lc_0.M);
        a = ee.E(Ic.D);
        i = ee.E(eC.D);
        B = ee.E(yb_0.M);
        C = ee.E(qc_0.A);
        H = ee.E(uc_2.C);
        e = ee.E(eb_1.M);
    }

    public static /* synthetic */ Collection<String> E(lc_0 a2) {
        return E.values();
    }

    private static /* synthetic */ Map<wB, String> E(wB a2) {
        a2 = new LinkedHashMap<wB, String>();
        a2.put(wB.M, "Above");
        a2.put(wB.c, "Below");
        return a2;
    }

    public static /* synthetic */ yb_0 E(String a2, yb_0 a3) {
        for (Map.Entry<yb_0, String> entry : B.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public /* synthetic */ ee() {
        ee a2;
    }

    public static /* synthetic */ Collection<String> E(rd_2 a2) {
        return ee.E(a2, false);
    }

    private static /* synthetic */ Map<lc_0, String> E(lc_0 a2) {
        a2 = new LinkedHashMap<lc_0, String>();
        a2.put(lc_0.M, "FarAbovePrice");
        a2.put(lc_0.b, "AbovePrice");
        a2.put(lc_0.C, "OnPrice");
        a2.put(lc_0.D, "BelowPrice");
        a2.put(lc_0.A, "FarBelowPrice");
        return a2;
    }

    public static /* synthetic */ la_1 E(String a2, la_1 a3) {
        for (Map.Entry<la_1, String> entry : G.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ String E(df_1 a2) {
        if (!b.containsKey((Object)a2)) {
            return "---";
        }
        return b.get((Object)a2);
    }

    public static /* synthetic */ String E(qc_0 a2) {
        if (!C.containsKey((Object)a2)) {
            return "---";
        }
        return C.get((Object)a2);
    }

    public static /* synthetic */ String E(xa_1 a2) {
        if (!d.containsKey((Object)a2)) {
            return "---";
        }
        return d.get((Object)a2);
    }

    public static /* synthetic */ Ic E(String a2, Ic a3) {
        for (Map.Entry<Ic, String> entry : a.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    private static /* synthetic */ Map<fe_1, String> E(fe_1 a2) {
        a2 = new LinkedHashMap<fe_1, String>();
        a2.put(fe_1.I, "");
        a2.put(fe_1.b, new String(Character.toChars(128077)));
        a2.put(fe_1.f, new String(Character.toChars(128200)));
        a2.put(fe_1.B, new String(Character.toChars(128201)));
        a2.put(fe_1.a, new String(Character.toChars(128214)));
        a2.put(fe_1.h, new String(Character.toChars(128270)));
        a2.put(fe_1.k, new String(Character.toChars(9878)));
        a2.put(fe_1.D, new String(Character.toChars(128721)));
        a2.put(fe_1.M, new String(Character.toChars(10133)));
        a2.put(fe_1.G, new String(Character.toChars(10134)));
        a2.put(fe_1.j, new String(Character.toChars(127937)));
        a2.put(fe_1.A, new String(Character.toChars(128640)));
        a2.put(fe_1.e, new String(Character.toChars(128308)));
        a2.put(fe_1.m, new String(Character.toChars(128994)));
        a2.put(fe_1.H, new String(Character.toChars(127956)));
        a2.put(fe_1.F, new String(Character.toChars(127939)));
        a2.put(fe_1.C, new String(Character.toChars(9889)));
        a2.put(fe_1.l, new String(Character.toChars(10548)));
        a2.put(fe_1.J, new String(Character.toChars(10549)));
        a2.put(fe_1.c, new String(Character.toChars(128176)));
        a2.put(fe_1.K, new String(Character.toChars(129529)));
        a2.put(fe_1.d, new String(Character.toChars(9876)));
        a2.put(fe_1.i, new String(Character.toChars(9167)));
        return a2;
    }

    public static /* synthetic */ za_1 E(String a2, za_1 a3) {
        for (Map.Entry<za_1, String> entry : F.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(df_1 a2) {
        return b.values();
    }

    public static /* synthetic */ Ad E(String a2, Ad a3) {
        for (Map.Entry<Ad, String> entry : K.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ Collection<String> E(qc_0 a2) {
        return C.values();
    }

    public static /* synthetic */ Collection<String> E(Ad a2) {
        return K.values();
    }

    public static /* synthetic */ Collection<String> E(xa_1 a2) {
        return d.values();
    }

    public static /* synthetic */ cC E(String a2, cC a3) {
        for (Map.Entry<cC, String> entry : J.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ String E(Ad a2) {
        if (!K.containsKey((Object)a2)) {
            return "---";
        }
        return K.get((Object)a2);
    }

    public static /* synthetic */ ja_0 E(String a2, ja_0 a3) {
        for (Map.Entry<ja_0, String> entry : D.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }

    public static /* synthetic */ String E(ja_0 a2) {
        if (!D.containsKey((Object)a2)) {
            return "---";
        }
        return D.get((Object)a2);
    }

    public static /* synthetic */ Collection<String> E(db_0 a2) {
        return A.values();
    }

    private static /* synthetic */ Map<la_1, String> E(la_1 a2) {
        a2 = new LinkedHashMap<la_1, String>();
        a2.put(la_1.c, "DarkGreen");
        a2.put(la_1.D, "LightGreen");
        a2.put(la_1.b, "DarkRed");
        a2.put(la_1.h, "LightRed");
        a2.put(la_1.A, "Blue");
        a2.put(la_1.C, "Orange");
        a2.put(la_1.H, "Yellow");
        return a2;
    }

    public static /* synthetic */ Collection<String> E(ja_0 a2) {
        return D.values();
    }

    public static /* synthetic */ String E(wB a2) {
        if (!I.containsKey((Object)a2)) {
            return "---";
        }
        return I.get((Object)a2);
    }

    public static /* synthetic */ Collection<String> E(uc_2 a2) {
        return H.values();
    }

    private static /* synthetic */ Map<ae_2, String> E(ae_2 a2) {
        a2 = new LinkedHashMap<ae_2, String>();
        a2.put(ae_2.c, "Native");
        a2.put(ae_2.M, "Synthetic");
        a2.put(ae_2.C, "Combined");
        return a2;
    }

    private static /* synthetic */ Map<cC, String> E(cC a2) {
        a2 = new LinkedHashMap<cC, String>();
        a2.put(cC.A, "SymbolOnly");
        a2.put(cC.C, "Compact");
        a2.put(cC.c, "Advanced");
        a2.put(cC.b, "Professional");
        return a2;
    }

    public static /* synthetic */ Collection<String> E(kc_1 a2) {
        return j.values();
    }

    public static /* synthetic */ wB E(String a2, wB a3) {
        for (Map.Entry<wB, String> entry : I.entrySet()) {
            if (!entry.getValue().equals(a2)) continue;
            return entry.getKey();
        }
        return a3;
    }
}

