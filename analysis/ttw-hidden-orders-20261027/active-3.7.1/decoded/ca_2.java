/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import javax.swing.JCheckBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.kd_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.va_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.cA
 */
public class ca_2
implements ItemListener {
    public final /* synthetic */ ze_2 A;
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ gd_0 M;
    public final /* synthetic */ sc_1 b;
    public final /* synthetic */ JCheckBox c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ca_2(gd_0 a2, JCheckBox a3, df_0 a4, sc_1 a5, ze_2 a6) {
        ca_2 a7;
        ca_2 ca_22 = a7;
        a7.M = a2;
        ca_22.c = a3;
        ca_22.C = a4;
        a7.b = a5;
        a7.A = a6;
    }

    @Override
    public void itemStateChanged(ItemEvent a2) {
        ca_2 a3;
        if (a3.c.isSelected() != ((va_0)a3.C.M).c) {
            ((va_0)a3.C.M).c = a3.c.isSelected();
            ca_2 ca_22 = a3;
            ca_22.b.E(((va_0)ca_22.C.M).c);
            ca_2 ca_23 = a3;
            a3.M.E().E("TTW-LiquidityTracker", ca_23.A.M, a3.C);
            ca_23.C.E(pf_0.h);
        }
    }
}

