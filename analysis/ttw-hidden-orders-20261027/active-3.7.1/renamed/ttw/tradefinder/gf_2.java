/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.go;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.qd_2;
import ttw.tradefinder.rd_2;
import ttw.tradefinder.te_1;
import ttw.tradefinder.va;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.GF
 */
public class gf_2 {
    public te_1 A;
    public rd_2 C;
    public String M;
    public boolean b;
    public String c;

    public gf_2(te_1 a2, rd_2 a3, boolean a4) {
        gf_2 a5;
        gf_2 gf_22 = a5;
        gf_2 gf_23 = a5;
        gf_2 gf_24 = a5;
        a5.A = te_1.A;
        a5.C = rd_2.C;
        gf_24.M = "";
        gf_24.c = "";
        gf_23.b = false;
        gf_23.A = a2;
        gf_22.C = a3;
        gf_22.b = a4;
    }

    public void E(go a2) {
        gf_2 a3;
        if (a2.a != null) {
            a3.A = va.E(a2.a);
        }
        if (a2.b != null) {
            a3.C = va.E(a2.b);
        }
        if (a2.c != null) {
            a3.M = a2.c;
        }
        if (a2.e != null) {
            a3.c = a2.e;
        }
        a3.b = a2.d;
        if (a3.M != null && !a3.M.isEmpty() && a3.c.isEmpty()) {
            a3.c = a3.M;
        }
    }

    public boolean boolean_E() {
        gf_2 a2;
        return a2.A != te_1.A;
    }

    public gf_2 ttw_tradefinder_gf_2_E() {
        gf_2 a2;
        gf_2 gf_22 = new gf_2();
        new gf_2().A = a2.A;
        gf_2 gf_23 = a2;
        gf_22.C = a2.C;
        gf_22.M = gf_23.M;
        gf_22.c = gf_23.c;
        gf_22.b = a2.b;
        return gf_22;
    }

    public go ttw_tradefinder_go_E() {
        gf_2 a2;
        go go2 = new go();
        new go().a = va.E(a2.A);
        go go3 = go2;
        go3.b = va.E(a2.C);
        go3.c = a2.M != null ? a2.M : "";
        go2.e = a2.c != null ? a2.c : "";
        go2.d = a2.b;
        return go2;
    }

    public String j(String a2, String a3, String a4, String a5) {
        gf_2 a6;
        return a6.E(a2, a3, a4, a5, pe_1.E("q\u007f"));
    }

    public qd_2 E(String a2, String a3, String a4, String a5, boolean a6) {
        gf_2 a7;
        if (a7.A == te_1.b) {
            gf_2 gf_22 = a7;
            return new qd_2(gf_22.A, gf_22.C);
        }
        if (a7.A == te_1.D) {
            if (a6) {
                gf_2 gf_23 = a7;
                return new qd_2(gf_23.A, gf_23.c);
            }
            gf_2 gf_24 = a7;
            return new qd_2(gf_24.A, gf_24.M);
        }
        if (a7.A == te_1.c) {
            return new qd_2(a7.A, a7.E(a2, a3, a4, a5, pe_1.E("q\u007f")));
        }
        if (a7.A == te_1.M) {
            return new qd_2(a7.A, a7.E(a2, a3, a5, wa_2.java_lang_String_E("\u00149")));
        }
        return new qd_2(te_1.A, "");
    }

    public qd_2 ttw_tradefinder_qd_2_E() {
        gf_2 a2;
        return a2.E("", "", "", "", false);
    }

    public String E(String a2, String a3, String a4, String a5, String a6) {
        gf_2 a7;
        Object object = "";
        Object object2 = "";
        if (a7.b && a5 != null && !a5.isEmpty()) {
            String string = a6;
            object = string + "at" + string + a5;
        }
        if (a4 != null && !a4.isEmpty()) {
            object2 = a6 + a4;
        }
        return new String(a2 + a6 + a3 + (String)object2 + (String)object).trim();
    }

    public String E(String a2, String a3, String a4, String a5) {
        gf_2 a6;
        Object object = "";
        if (a6.b && a4 != null && !a4.isEmpty()) {
            String string = a5;
            object = string + "at" + string + a4;
        }
        return new String(a2 + a5 + a3 + (String)object).trim();
    }

    public gf_2() {
        a2(te_1.A, rd_2.C, false);
        gf_2 a2;
    }

    public String E(String a2, String a3, String a4) {
        gf_2 a5;
        return a5.E(a2, a3, a4, wa_2.java_lang_String_E("\u00149"));
    }
}

