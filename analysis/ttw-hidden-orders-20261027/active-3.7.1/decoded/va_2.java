/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JLabel;
import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.pf_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.vA
 */
public class va_2
implements ChangeListener {
    public final /* synthetic */ ob_1 C;
    public final /* synthetic */ JLabel M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ df_0 c;

    @Override
    public void stateChanged(ChangeEvent a22) {
        va_2 a3;
        int a22 = ((JSlider)(a22 = (JSlider)a22.getSource())).getValue();
        if (a22 != ((ua_0)a3.c.M).H) {
            ((ua_0)a3.c.M).H = a22;
            va_2 va_22 = a3;
            va_22.M.setText(Integer.toString(((ua_0)va_22.c.M).H) + " %");
            va_2 va_23 = a3;
            a3.C.E().E(a3.C.E().f(), va_23.b.M, a3.c);
            va_23.c.E(pf_0.m);
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ va_2(ob_1 a2, df_0 a3, JLabel a4, ze_2 a5) {
        va_2 a6;
        va_2 va_22 = a6;
        va_22.C = a2;
        va_22.c = a3;
        a6.M = a4;
        a6.b = a5;
    }
}

