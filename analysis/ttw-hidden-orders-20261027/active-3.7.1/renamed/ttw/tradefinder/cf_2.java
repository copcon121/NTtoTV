/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Map;
import ttw.tradefinder.bf_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.ei;
import ttw.tradefinder.hg_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.n_0;
import ttw.tradefinder.pf_0;

/*
 * Renamed from ttw.tradefinder.cf
 */
public class cf_2
implements n_0 {
    private String A;
    private final ed_2 C;
    private final df_0<jA, ei> M;
    private final String b;
    private String c;

    public cf_2(ed_2 a2, String a3) {
        cf_2 a4;
        cf_2 cf_22 = a4;
        a4.c = "";
        cf_22.A = "";
        cf_22.C = a2;
        a4.b = a3;
        a4.M = a2.E();
        a4.c = ((jA)a4.M.M).M;
        a4.A = a4.C.j(((jA)a4.M.M).C);
        a4.M.E(a4);
    }

    public void E(hg_0 a2, bf_2 a3, Map<String, String> a4) {
        cf_2 a5;
        cf_2 cf_22 = a5;
        a5.C.E(a2, a3, cf_22.b, cf_22.c, a5.A, a4);
    }

    public void E() {
        cf_2 a2;
        a2.M.j(a2);
    }

    @Override
    public void E(pf_0 a2) {
        if (a2 == pf_0.T) {
            cf_2 a3;
            a3.c = ((jA)a3.M.M).M;
            a3.A = a3.C.j(((jA)a3.M.M).C);
        }
    }
}

