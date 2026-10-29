/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable$Marker
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import ttw.tradefinder.a_0;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.da_1;
import ttw.tradefinder.hc_0;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;

/*
 * Renamed from ttw.tradefinder.pB
 */
public class pb_0
implements a_0 {
    private final cc_0 b;
    private final double c;

    @Override
    public OnlineCalculatable.Marker E(da_1 a2) {
        pb_0 a3;
        BufferedImage bufferedImage = hc_0.E(a2, a3.b);
        return new OnlineCalculatable.Marker(a3.c, hc_0.E(a2.c, bufferedImage.getWidth()), hc_0.E(a2, bufferedImage.getHeight()), bufferedImage);
    }

    public pb_0(cc_0 a2, double a3) {
        pb_0 a4;
        pb_0 pb_02 = a4;
        pb_02.b = a2;
        pb_02.c = a3;
    }
}

