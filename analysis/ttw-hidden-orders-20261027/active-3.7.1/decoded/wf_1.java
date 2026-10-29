/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.HorizontalValueLinesInfo
 */
package ttw.tradefinder;

import java.util.Map;
import ttw.tradefinder.sd_2;
import velox.api.layer1.messages.indicators.HorizontalValueLinesInfo;

/*
 * Renamed from ttw.tradefinder.Wf
 */
public class wf_1
implements HorizontalValueLinesInfo {
    public final /* synthetic */ sd_2 c;

    public Map<Double, String> getHorizontalLines(String a2) {
        wf_1 a3;
        wf_1 wf_12 = a3;
        return wf_12.c.E(wf_12.c.M, a2);
    }

    public /* synthetic */ wf_1(sd_2 a2) {
        wf_1 a3;
        a3.c = a2;
    }
}

