/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.function.BiConsumer;
import ttw.tradefinder.na_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.oa_2;
import ttw.tradefinder.pf_0;

/*
 * Renamed from ttw.tradefinder.oC
 */
public class oc_0
implements BiConsumer<Integer, na_0> {
    public final /* synthetic */ oa_2 c;

    public void E(Integer a2, na_0 a3) {
        oc_0 a4;
        if (!a3.C) {
            return;
        }
        if (a3.H <= a4.c.M && a3.H >= a4.c.h) {
            ((oa_0)a4.c.c.M).j(a2);
            oc_0 oc_02 = a4;
            oc_0 oc_03 = a4;
            oa_2.ttw_tradefinder_f_0_E(oc_02.c).E(oc_03.c.A, oa_2.ttw_tradefinder_ze_2_E((oa_2)a4.c).M, a4.c.c);
            oc_02.c.c.E(pf_0.r);
            oc_03.c.H.A(oa_2.j((oa_2)a4.c).M);
            return;
        }
        a4.c.E.E(a2, a3, a4.c.M, a4.c.h);
    }

    public /* synthetic */ oc_0(oa_2 a2) {
        oc_0 a3;
        a3.c = a2;
    }
}

