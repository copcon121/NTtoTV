/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.Oe;
import ttw.tradefinder.ed_0;
import ttw.tradefinder.jf_1;

/*
 * Renamed from ttw.tradefinder.Ge
 */
public class ge_0
extends Oe {
    private /* synthetic */ ge_0(String a2, boolean a3, ed_0 a4) {
        ge_0 a5;
        ge_0 ge_02 = a5;
        super(a2, a3, a4);
        ge_02.C.a();
    }

    public static /* synthetic */ ge_0 E(jf_1 a2) {
        jf_1 jf_12 = a2;
        ge_0 ge_02 = new ge_0((String)jf_12.D, (boolean)jf_12.M, (ed_0)a2.C);
        new ge_0((String)jf_12.D, (boolean)jf_12.M, (ed_0)a2.C).h = a2.h;
        jf_1 jf_13 = a2;
        ge_0 ge_03 = ge_02;
        jf_1 jf_14 = a2;
        ge_0 ge_04 = ge_02;
        jf_1 jf_15 = a2;
        ge_02.A = jf_15.A;
        ge_04.k = jf_15.k;
        ge_04.a = a2.a;
        ge_02.j = jf_14.j;
        ge_03.E = jf_14.E;
        ge_03.H = (long)a2.H;
        ge_02.c = jf_13.c;
        ge_02.K = jf_13.K;
        ge_02.b = a2.b;
        return ge_02;
    }
}

