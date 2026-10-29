/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.KB;
import ttw.tradefinder.Oa;
import ttw.tradefinder.df_0;
import ttw.tradefinder.gd_0;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ze_2;

public class Bg
implements ChangeListener {
    public final /* synthetic */ gd_0 C;
    public final /* synthetic */ JSpinner M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ Bg(gd_0 a2, JSpinner a3, df_0 a4, ze_2 a5) {
        Bg a6;
        Bg bg = a6;
        bg.C = a2;
        bg.M = a3;
        a6.c = a4;
        a6.b = a5;
    }

    @Override
    public void stateChanged(ChangeEvent a2) {
        Bg a3;
        a2 = a3.M.getModel();
        if (a2 instanceof SpinnerNumberModel && (Integer)((SpinnerNumberModel)a2).getNumber() != ((Oa)a3.c.M).k) {
            ((Oa)a3.c.M).k = (Integer)((SpinnerNumberModel)a2).getNumber();
            Bg bg = a3;
            a3.C.E().E(KB.E("\u0006\u0010\u0005i\u001e-#1; ;0+\u0010 %1/76"), bg.b.M, a3.c);
            bg.c.E(pf_0.w);
        }
    }
}

