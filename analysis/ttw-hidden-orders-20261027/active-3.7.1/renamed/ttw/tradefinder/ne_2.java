/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.List;
import ttw.tradefinder.K;
import ttw.tradefinder.af_0;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.rf_1;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.y;
import ttw.tradefinder.z_0;

/*
 * Renamed from ttw.tradefinder.ne
 */
public class ne_2 {
    private final af_0 j;
    private final String a;
    private final int h;
    private List<ne_2> H;
    private final boolean D;
    private boolean A;
    private final K C;
    private final xf_1 M;
    private List<rf_1> b;
    private List<ne_2> c;

    public void void_E() {
        ne_2 a2;
        a2.C.void_E();
    }

    public void E(z_0 a2, nf_0 a3) {
        ne_2 a4;
        a4.b.add(new rf_1(a2, a3));
        a2.E(a4);
    }

    public ne_2(f_0 a2, y a3, int a4) {
        a5(a2, a3, a4, xf_1.M, af_0.B);
        ne_2 a5;
    }

    public boolean E(dd_1 a2, boolean a3) {
        ne_2 a4;
        if (!a4.C.E(a2)) {
            return false;
        }
        return a3 || a4.D;
    }

    public ne_2(f_0 a2, y a3, int a4, xf_1 a5, af_0 a6) {
        ne_2 a7;
        ne_2 ne_22 = a7;
        ne_2 ne_23 = a7;
        ne_2 ne_24 = a7;
        ne_2 ne_25 = a7;
        a7.A = true;
        a7.b = new ArrayList<rf_1>();
        ne_25.H = new ArrayList<ne_2>();
        ne_25.c = new ArrayList<ne_2>();
        ne_25.a = a3.java_lang_String_E();
        ne_24.h = a4;
        ne_24.D = a3.boolean_E();
        ne_23.j = a6;
        ne_23.C = a3.E(a2.ttw_tradefinder_qc_1_E()).E(null);
        ne_22.M = a5;
        ne_22.A = true;
    }

    public xf_1 ttw_tradefinder_xf_1_E() {
        ne_2 a2;
        return a2.M;
    }

    public af_0 ttw_tradefinder_af_0_E() {
        ne_2 a2;
        return a2.j;
    }

    public void E(z_0 a2) {
        ne_2 a3;
        a3.E(a2, nf_0.O);
    }

    public String java_lang_String_E() {
        ne_2 a2;
        return a2.a;
    }

    private /* synthetic */ void j(ne_2 a2) {
        ne_2 a3;
        a3.H.add(a2);
    }

    public void E(boolean a2) {
        a.A = a2;
    }

    public void E(ne_2 a2, boolean a3) {
        ne_2 a4;
        ne_2 ne_22 = a4;
        ne_2 ne_23 = a2;
        ne_22.c.add(ne_23);
        a2.j(a4);
        ne_23.E(ne_22.M == xf_1.M ? a3 : false);
    }

    public List<rf_1> a() {
        ne_2 a2;
        return a2.b;
    }

    public boolean boolean_E() {
        ne_2 a2;
        return a2.A;
    }

    public ne_2(f_0 a2, y a3) {
        a4(a2, a3, -1);
        ne_2 a4;
    }

    public void E(ne_2 a2) {
        ne_2 a3;
        a3.E(a2, true);
    }

    public int int_E() {
        ne_2 a2;
        return a2.h;
    }

    public List<ne_2> j() {
        ne_2 a2;
        return a2.H;
    }

    public List<ne_2> E() {
        ne_2 a2;
        return a2.c;
    }
}

