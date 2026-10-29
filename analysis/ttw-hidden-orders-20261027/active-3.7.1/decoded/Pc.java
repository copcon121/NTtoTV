/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.List;
import ttw.tradefinder.K;
import ttw.tradefinder.bd_2;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.g_0;
import ttw.tradefinder.l;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.uc;

public class Pc
implements l {
    private final String C;
    private final List<cd> M;
    private final qc_1 b;
    private final List<dd_1> c;

    public /* synthetic */ Pc(String a2, List<cd> a3, qc_1 a4) {
        a5(a2, a3, bd_2.E(), a4);
        Pc a5;
    }

    public /* synthetic */ Pc(String a2, List<cd> a3, List<dd_1> a4, qc_1 a5) {
        Pc a6;
        Pc pc = a6;
        Pc pc2 = a6;
        pc2.b = a5;
        pc2.C = a2;
        pc.M = a3;
        pc.c = a4;
    }

    @Override
    public /* synthetic */ K E(g_0 a2) {
        Pc a3;
        Pc pc = a3;
        a2 = new uc(pc.C, pc.b, a3.c, (g_0)a2);
        ((uc)a2).E(a3.M);
        return a2;
    }
}

