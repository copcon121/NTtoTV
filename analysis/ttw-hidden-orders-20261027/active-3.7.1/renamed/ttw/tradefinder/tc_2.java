/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.TC
 */
public class tc_2
implements ItemListener {
    public final /* synthetic */ gd_0 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ sc_1 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tc_2(gd_0 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        tc_2 a7;
        tc_2 tc_22 = a7;
        a7.A = a2;
        tc_22.C = a3;
        tc_22.b = a4;
        a7.M = a5;
        a7.c = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        tc_2 a3;
        if (a3.C.isSelected() != ((Oa)a3.b.M).a) {
            ((Oa)a3.b.M).a = a3.C.isSelected();
            tc_2 tc_22 = a3;
            tc_22.M.E(((Oa)tc_22.b.M).a);
            tc_2 tc_23 = a3;
            a3.A.ttw_tradefinder_f_0_E().E(pe_1.E("\t\u000b\nr\u00116,*4;4+$\u000b/>>48-"), tc_23.c.M, a3.b);
            tc_23.b.E(pf_0.o);
        }
    }
}

