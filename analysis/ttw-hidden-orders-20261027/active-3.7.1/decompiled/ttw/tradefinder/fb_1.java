/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 */
package ttw.tradefinder;

import java.util.function.BiConsumer;
import ttw.tradefinder.na_0;
import ttw.tradefinder.uc_0;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;

/*
 * Renamed from ttw.tradefinder.Fb
 */
public class fb_1
implements BiConsumer<Integer, na_0> {
    public final /* synthetic */ uc_0 c;

    public /* synthetic */ fb_1(uc_0 a2) {
        fb_1 a3;
        a3.c = a2;
    }

    public void E(Integer a2, na_0 a3) {
        fb_1 a4;
        a2 = a4.c.b;
        synchronized (a2) {
            if (a4.c.C == null) {
                return;
            }
            fb_1 fb_12 = a4;
            a3 = fb_12.c.E(a3);
            fb_12.c.C.E((ScreenSpaceCanvas.CanvasIcon)a3);
            return;
        }
    }
}

