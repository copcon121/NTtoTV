/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.IndicatorColorInterface
 *  velox.colors.ColorsChangedListener
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.HashSet;
import java.util.Set;
import ttw.tradefinder.sd_2;
import velox.api.layer1.messages.indicators.IndicatorColorInterface;
import velox.colors.ColorsChangedListener;

/*
 * Renamed from ttw.tradefinder.Qf
 */
public class qf_2
implements IndicatorColorInterface {
    public final Set<ColorsChangedListener> M;
    public final /* synthetic */ sd_2 b;
    public final /* synthetic */ String c;

    public void addColorChangeListener(ColorsChangedListener a2) {
        qf_2 a3;
        a3.M.add(a2);
    }

    public void set(String a2, Color a3) {
        qf_2 a4;
        qf_2 qf_22 = a4;
        a4.b.setColor(qf_22.c, (String)a2, a3);
        Object object = a2 = qf_22.M.iterator();
        while (object.hasNext()) {
            a3 = (ColorsChangedListener)a2.next();
            a3.onColorsChanged();
            object = a2;
        }
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ qf_2(sd_2 a2, String a3) {
        qf_2 a4;
        qf_2 qf_22 = a4;
        a4.b = a2;
        qf_22.c = a3;
        qf_22.M = new HashSet<ColorsChangedListener>();
    }

    public Color getOrDefault(String a2, Color a3) {
        qf_2 a4;
        qf_2 qf_22 = a4;
        return qf_22.b.getColor(qf_22.c, a2);
    }
}

