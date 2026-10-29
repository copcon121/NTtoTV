/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable$Marker
 */
package ttw.tradefinder;

import java.awt.image.BufferedImage;
import ttw.tradefinder.Jd;
import ttw.tradefinder.a_0;
import ttw.tradefinder.dc;
import ttw.tradefinder.fC;
import velox.api.layer1.layers.strategies.interfaces.OnlineCalculatable;

public class JB
implements a_0 {
    private final double b;
    private final Jd c;

    public JB(Jd a2, double a3) {
        JB a4;
        JB jB = a4;
        jB.c = a2;
        jB.b = a3;
    }

    @Override
    public OnlineCalculatable.Marker E(fC a2) {
        JB a3;
        BufferedImage bufferedImage = dc.E(a2, a3.c);
        return new OnlineCalculatable.Marker(a3.b, dc.E(a2.D, bufferedImage.getWidth()), dc.E(a2, bufferedImage.getHeight(), a3.c.E()), bufferedImage);
    }
}

