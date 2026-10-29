/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Oa;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

public class sf
implements ItemListener {
    public final /* synthetic */ JCheckBox A;
    public final /* synthetic */ sc_1 C;
    public final /* synthetic */ ze_2 M;
    public final /* synthetic */ gd_0 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        sf a3;
        if (a3.A.isSelected() != ((Oa)a3.c.M).h) {
            ((Oa)a3.c.M).h = a3.A.isSelected();
            sf sf2 = a3;
            sf2.C.E(((Oa)sf2.c.M).h);
            sf sf3 = a3;
            a3.b.ttw_tradefinder_f_0_E().E(cc_0.E("v\u0000uyn=S!K0K [\u0000P5A?G&"), sf3.M.M, a3.c);
            sf3.c.E(pf_0.O);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ sf(gd_0 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        sf a7;
        sf sf2 = a7;
        a7.b = a2;
        sf2.A = a3;
        sf2.c = a4;
        a7.C = a5;
        a7.M = a6;
    }
}

