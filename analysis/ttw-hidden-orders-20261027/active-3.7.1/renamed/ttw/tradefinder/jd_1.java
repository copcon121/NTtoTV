/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.af_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ya_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.JD
 */
public class jd_1
implements ItemListener {
    public final /* synthetic */ df_0 A;
    public final /* synthetic */ fg C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ JCheckBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ jd_1(fg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        jd_1 a7;
        jd_1 jd_12 = a7;
        a7.C = a2;
        jd_12.c = a3;
        jd_12.A = a4;
        a7.b = a5;
        a7.M = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        jd_1 a3;
        if (a3.c.isSelected() != ((ya_0)a3.A.M).M) {
            ((ya_0)a3.A.M).M = a3.c.isSelected();
            jd_1 jd_12 = a3;
            jd_12.b.E(((ya_0)jd_12.A.M).M);
            jd_1 jd_13 = a3;
            a3.C.ttw_tradefinder_f_0_E().E(af_2.E(":G9>'~\fr\u0002r\u0000p\u000bG\u001cr\rx\u000ba"), jd_13.M.M, a3.A);
            jd_13.A.E(pf_0.h);
        }
    }
}

