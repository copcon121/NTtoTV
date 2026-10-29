/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import ttw.tradefinder.bb_1;
import ttw.tradefinder.df_0;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.qA
 */
public class qa_1
implements ActionListener {
    public final /* synthetic */ int D;
    public final /* synthetic */ bb_1 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ sc_1 c;

    /*
     * Unable to fully structure code
     */
    @Override
    public void actionPerformed(ActionEvent a) {
        a = false;
        if (((oa_0)a.C.M).int_E() >= bb_1.M) {
            a = true;
        }
        ((oa_0)a.C.M).void_E(a.D);
        v0 = a;
        a.A.ttw_tradefinder_f_0_E().E(a.A.ttw_tradefinder_r_0_E().f(), v0.M.M, a.C);
        v0.C.E(pf_0.r);
        if (a) ** GOTO lbl-1000
        v1 = a;
        if (v1.c.boolean_E(v1.b)) {
            v2 = a;
            v3 = v2;
            a.A.l(v2.M.M);
        } else lbl-1000:
        // 2 sources

        {
            v4 = a;
            v3 = v4;
            v4.A.A(v4.M.M);
        }
        v3.A.ttw_tradefinder_f_0_E().void_E(a.M.M, a.A.java_lang_String_E() + a.D);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qa_1(bb_1 a2, df_0 a3, int a4, ze_2 a5, sc_1 a6, sc_1 a7) {
        qa_1 a8;
        qa_1 qa_12 = a8;
        qa_1 qa_13 = a8;
        qa_13.A = a2;
        qa_13.C = a3;
        qa_12.D = a4;
        qa_12.M = a5;
        a8.c = a6;
        a8.b = a7;
    }
}

