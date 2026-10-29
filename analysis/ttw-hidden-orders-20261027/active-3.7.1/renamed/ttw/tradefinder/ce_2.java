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
import ttw.tradefinder.mf_1;
import ttw.tradefinder.sa;

/*
 * Renamed from ttw.tradefinder.CE
 */
public class ce_2
implements ActionListener {
    public final /* synthetic */ df_0 M;
    public final /* synthetic */ JComboBox b;
    public final /* synthetic */ mf_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ce_2(mf_1 a2, JComboBox a3, df_0 a4) {
        ce_2 a5;
        a5.c = a2;
        a5.b = a3;
        a5.M = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ce_2 a3;
        a2 = ee.E(a3.b.getSelectedItem().toString(), df_1.b);
        if (a2 != ((sa)a3.M.M).c) {
            ((sa)a3.M.M).c = a2;
            ce_2 ce_22 = a3;
            a3.c.b.E(a3.c.b.java_lang_String_E(), ce_22.M);
            ce_22.c.b.void_E();
        }
    }
}

