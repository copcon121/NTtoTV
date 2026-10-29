/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasShape
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.VD
 */
public class vd_1 {
    private final Object M = new Object();
    private final List<ScreenSpaceCanvas.CanvasIcon> b = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private ScreenSpaceCanvas c = null;

    public void E(ScreenSpaceCanvas.CanvasIcon a2) {
        vd_1 a3;
        Object object = a3.M;
        synchronized (object) {
            if (a3.c == null) {
                return;
            }
            vd_1 vd_12 = a3;
            vd_12.c.addShape((ScreenSpaceCanvas.CanvasShape)a2);
            vd_12.b.add(a2);
            return;
        }
    }

    public vd_1(ScreenSpaceCanvas a2) {
        vd_1 a3;
        a3.c = a2;
        a3.b.clear();
    }

    public void j() {
        vd_1 a2;
        vd_1 vd_12 = a2;
        vd_12.E();
        Object object = vd_12.M;
        synchronized (object) {
            if (a2.c == null) {
                return;
            }
            a2.c.dispose();
            a2.c = null;
            return;
        }
    }

    public int E() {
        vd_1 a2;
        return a2.b.size();
    }

    public void E() {
        vd_1 a2;
        Object object = a2.M;
        synchronized (object) {
            if (a2.c != null) {
                Iterator<ScreenSpaceCanvas.CanvasIcon> iterator;
                Iterator<ScreenSpaceCanvas.CanvasIcon> iterator2 = iterator = a2.b.iterator();
                while (iterator2.hasNext()) {
                    ScreenSpaceCanvas.CanvasIcon canvasIcon = iterator.next();
                    iterator2 = iterator;
                    a2.c.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
                }
            }
            a2.b.clear();
            return;
        }
    }
}

