/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import ttw.tradefinder.K;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.bg_0;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ei;
import ttw.tradefinder.f_0;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.r_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.tf_1;
import ttw.tradefinder.wf_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.ED
 */
public class ed_2 {
    private bg_0 H;
    private final f_0 D;
    private boolean A;
    private wf_2 C;
    private boolean M;
    private final K b;
    private final r_0 c;

    public void j(String a2, String a3, String a4) {
        ed_2 a5;
        if (a5.b.E(dd_1.M)) {
            a5.H.E(a2, a3, a4);
        }
    }

    public Collection<? extends sc_1> E(ze_2 a2) {
        ed_2 a3;
        if (!a3.D.j()) {
            return Collections.emptyList();
        }
        return a3.C.E(a3.E(), a2, a3.D);
    }

    public String j(String a2) {
        ed_2 a3;
        return a3.C.E(a2);
    }

    public void E(String a2, String a3) {
        ed_2 a4;
        if (a4.b.E(dd_1.M)) {
            a4.H.E(a2, a3);
        }
    }

    public void j() {
        ed_2 a2;
        if (a2.A) {
            return;
        }
        if (!a2.D.j()) {
            return;
        }
        a2.H.E();
        a2.A = true;
    }

    public void E(hg_0 a2, bf_2 a3, String a4, String a5, String a6, Map<String, String> a7) {
        ed_2 a8;
        if (a8.b.E(dd_1.M)) {
            a8.H.E(a2, a3, a4, a5, a6, a7);
        }
    }

    public ed_2(f_0 a2, r_0 a3, qc_1 a4) {
        ed_2 a5;
        ed_2 ed_22 = a5;
        ed_2 ed_23 = a5;
        ed_2 ed_24 = a5;
        ed_2 ed_25 = a5;
        a5.H = new bg_0();
        ed_25.C = null;
        ed_25.A = false;
        ed_24.M = true;
        ed_24.D = a2;
        ed_23.c = a3;
        ed_23.C = new wf_2(a2, a5, a3);
        ed_23.A = false;
        ed_22.M = true;
        ed_22.b = a3.a(a4).E(new tf_1(a5, a2));
    }

    public String E(String a2) {
        ed_2 a3;
        return a3.C.j(a2);
    }

    public boolean E(dd_1 a2) {
        ed_2 a3;
        if (!a3.D.j()) {
            return false;
        }
        return a3.C.E(a2);
    }

    public void E(String a2, String a3, String a4) {
        ed_2 a5;
        if (a5.b.E(dd_1.M)) {
            a5.H.j(a2, a3, a4);
        }
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 2 << 3 ^ 5;
        int cfr_ignored_0 = (2 ^ 5) << 4 ^ 3;
        int n5 = n3;
        int n6 = 4 << 3 ^ (3 ^ 5);
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

    public df_0<jA, ei> E() {
        ed_2 a2;
        ed_2 ed_22 = a2;
        return ed_22.D.E(ed_22.c.f(), new jA());
    }

    public void E() {
        ed_2 a2;
        ed_2 ed_22 = a2;
        ed_22.H.j();
        ed_22.C.E();
        ed_22.b.E();
    }

    public void E(df_0<jA, ei> a2) {
        ed_2 a3;
        ed_2 ed_22 = a3;
        ed_22.D.E(ed_22.c.f(), a2);
    }
}

