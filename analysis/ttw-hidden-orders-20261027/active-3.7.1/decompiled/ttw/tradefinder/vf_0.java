/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.ge_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ya_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.vf
 */
public class vf_0
implements ItemListener {
    public final /* synthetic */ sc_1 A;
    public final /* synthetic */ fg C;
    public final /* synthetic */ JCheckBox M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vf_0(fg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        vf_0 a7;
        vf_0 vf_02 = a7;
        a7.C = a2;
        vf_02.M = a3;
        vf_02.c = a4;
        a7.A = a5;
        a7.b = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        vf_0 a3;
        if (a3.M.isSelected() != ((ya_0)a3.c.M).c) {
            ((ya_0)a3.c.M).c = a3.M.isSelected();
            vf_0 vf_02 = a3;
            vf_02.A.E(((ya_0)vf_02.c.M).c);
            vf_0 vf_03 = a3;
            a3.C.E().E(ge_1.E("\\(_QA\u0011j\u001dd\u001df\u001fm(z\u001dk\u0017m\u000e"), vf_03.b.M, a3.c);
            vf_03.c.E(pf_0.h);
        }
    }
}

