/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.colors.ColorsChangedListener
 */
package ttw.tradefinder;

import ttw.tradefinder.sd_2;
import velox.colors.ColorsChangedListener;

/*
 * Renamed from ttw.tradefinder.yD
 */
public class yd_1
implements ColorsChangedListener {
    public final /* synthetic */ String b;
    public final /* synthetic */ sd_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ yd_1(sd_2 a2, String a3) {
        yd_1 a4;
        a4.c = a2;
        a4.b = a3;
    }

    public void onColorsChanged() {
        yd_1 a2;
        yd_1 yd_12 = a2;
        yd_12.c.d(yd_12.b);
    }
}

