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
import java.util.Collections;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ma_2;
import ttw.tradefinder.me_1;
import velox.api.layer1.messages.indicators.IndicatorColorScheme;

/*
 * Renamed from ttw.tradefinder.gg
 */
public class gg_0
implements IndicatorColorScheme {
    public final /* synthetic */ ma_2 b;
    public final /* synthetic */ f_0 c;

    public String getColorFor(Double a2) {
        return "default";
    }

    public IndicatorColorScheme.ColorDescription[] getColors() {
        gg_0 a2;
        return Collections.singletonList(new IndicatorColorScheme.ColorDescription(a2.c.getClass(), "default", Color.WHITE, false)).toArray(new IndicatorColorScheme.ColorDescription[0]);
    }

    public IndicatorColorScheme.ColorIntervalResponse getColorIntervalsList(double a2, double a3) {
        return new IndicatorColorScheme.ColorIntervalResponse(new String[]{"default"}, new double[0]);
    }

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ gg_0(ma_2 a2, f_0 a3) {
        gg_0 a4;
        a4.b = a2;
        a4.c = a3;
    }
}

