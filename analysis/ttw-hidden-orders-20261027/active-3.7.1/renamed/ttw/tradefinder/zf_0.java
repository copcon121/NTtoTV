/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.Zc;
import ttw.tradefinder.df_0;
import ttw.tradefinder.fg;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.zf
 */
public class zf_0
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ JCheckBox C;
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ fg b;
    public final /* synthetic */ sc_1 c;

    @Override
    public void itemStateChanged(ItemEvent a2) {
        zf_0 a3;
        if (a3.C.isSelected() != ((Zc)a3.M.M).H) {
            ((Zc)a3.M.M).H = a3.C.isSelected();
            zf_0 zf_02 = a3;
            zf_02.c.E(((Zc)zf_02.M.M).H);
            zf_0 zf_03 = a3;
            a3.b.ttw_tradefinder_f_0_E().E(pe_1.E("\t\u000b\nr\u00142?>1>3<8\u000b/>>48-"), zf_03.A.M, a3.M);
            zf_03.M.E(pf_0.i);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ zf_0(fg a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        zf_0 a7;
        zf_0 zf_02 = a7;
        a7.b = a2;
        zf_02.C = a3;
        zf_02.M = a4;
        a7.c = a5;
        a7.A = a6;
    }
}

