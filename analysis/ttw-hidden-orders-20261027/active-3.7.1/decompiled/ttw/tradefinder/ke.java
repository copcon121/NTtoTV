/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComboBox;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.lg;
import ttw.tradefinder.pe_1;
import ttw.tradefinder.xa_0;
import ttw.tradefinder.ze_2;

public class ke
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ lg M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ ze_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ke(lg a2, JComboBox a3, df_0 a4, ze_2 a5) {
        ke a6;
        ke ke2 = a6;
        ke2.M = a2;
        ke2.b = a3;
        a6.C = a4;
        a6.c = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ke a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((xa_0)a3.C.M).b) {
            ((xa_0)a3.C.M).b = a2;
            a3.M.E().E(pe_1.E("\t\u000b\nr\u0010>/48+\u0018'-32-8-"), a3.c.M, a3.C);
        }
    }
}

