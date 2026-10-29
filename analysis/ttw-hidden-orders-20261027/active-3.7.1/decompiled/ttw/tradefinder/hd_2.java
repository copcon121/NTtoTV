/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.jA;
import ttw.tradefinder.wf_2;

/*
 * Renamed from ttw.tradefinder.hD
 */
public class hd_2
implements ActionListener {
    public final /* synthetic */ wf_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ hd_2(wf_2 a2, df_0 a3) {
        hd_2 a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        hd_2 a3;
        hd_2 hd_22 = a3;
        a3.b.A.E(((jA)a3.c.M).M, hd_22.b.E(((jA)hd_22.c.M).C));
    }
}

