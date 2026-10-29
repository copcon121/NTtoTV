/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme$ColorDescription
 *  velox.api.layer1.messages.indicators.IndicatorColorScheme$ColorIntervalResponse
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import ttw.tradefinder.sd_2;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;

/*
 * Renamed from ttw.tradefinder.zE
 */
public class ze_1
implements IndicatorColorScheme {
    public final /* synthetic */ sd_2 c;

    public /* synthetic */ ze_1(sd_2 a2) {
        ze_1 a3;
        a3.c = a2;
    }

    public IndicatorColorScheme.ColorDescription[] getColors() {
        ze_1 a2;
        Iterator<Map.Entry<String, Color>> iterator;
        ArrayList<IndicatorColorScheme.ColorDescription> arrayList = new ArrayList<IndicatorColorScheme.ColorDescription>();
        Iterator<Map.Entry<String, Color>> iterator2 = iterator = a2.c.h.entrySet().iterator();
        while (iterator2.hasNext()) {
            IndicatorColorScheme.ColorDescription colorDescription = iterator.next();
            colorDescription = new IndicatorColorScheme.ColorDescription(a2.c.ttw_tradefinder_f_0_E().getClass(), colorDescription.getKey(), colorDescription.getValue(), false);
            iterator2 = iterator;
            arrayList.add(colorDescription);
        }
        return arrayList.toArray(new IndicatorColorScheme.ColorDescription[0]);
    }

    public String getColorFor(Double a2) {
        ze_1 a3;
        ze_1 ze_12 = a3;
        return ze_12.c.E(ze_12.c.M, a2);
    }

    public IndicatorColorScheme.ColorIntervalResponse getColorIntervalsList(double a2, double a3) {
        ze_1 a4;
        ze_1 ze_12 = a4;
        return ze_12.c.E(ze_12.c.M, a2, a3);
    }
}

