/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.ValuesFormatter
 */
package ttw.tradefinder;

import ttw.tradefinder.ac_2;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.sd_2;
import velox.api.layer1.messages.indicators.ValuesFormatter;

/*
 * Renamed from ttw.tradefinder.Pf
 */
public class pf_1
implements ValuesFormatter {
    public final /* synthetic */ sd_2 c;

    public String formatWidget(double a2) {
        pf_1 a3;
        if (Double.isNaN(a2)) {
            return ac_2.E("O9O");
        }
        return a3.c.c.format(a2);
    }

    public /* synthetic */ pf_1(sd_2 a2) {
        pf_1 a3;
        a3.c = a2;
    }

    public String formatTooltip(double a2, double a3, double a4, int a5) {
        pf_1 a6;
        if (Double.isNaN(a2)) {
            return bb_2.E("xpx");
        }
        return a6.c.c.format(a2);
    }
}

