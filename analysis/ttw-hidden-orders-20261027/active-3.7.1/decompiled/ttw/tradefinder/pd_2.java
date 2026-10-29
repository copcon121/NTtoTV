/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasShape
 */
package ttw.tradefinder;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.pD
 */
public class pd_2 {
    private final Object M = new Object();
    private ScreenSpaceCanvas b = null;
    private final Map<String, ScreenSpaceCanvas.CanvasIcon> c = new HashMap<String, ScreenSpaceCanvas.CanvasIcon>();

    public void E(String a2, ScreenSpaceCanvas.CanvasIcon a3) {
        pd_2 a4;
        Object object = a4.M;
        synchronized (object) {
            if (a4.b == null) {
                return;
            }
            if (a4.c.containsKey(a2)) {
                pd_2 pd_22 = a4;
                pd_22.b.removeShape((ScreenSpaceCanvas.CanvasShape)pd_22.c.get(a2));
            }
            pd_2 pd_23 = a4;
            pd_23.b.addShape((ScreenSpaceCanvas.CanvasShape)a3);
            pd_23.c.put(a2, a3);
            return;
        }
    }

    public pd_2(ScreenSpaceCanvas a2) {
        pd_2 a3;
        a3.b = a2;
        a3.c.clear();
    }

    public void j() {
        pd_2 a2;
        Object object = a2.M;
        synchronized (object) {
            if (a2.b != null) {
                Iterator<ScreenSpaceCanvas.CanvasIcon> iterator;
                Iterator<ScreenSpaceCanvas.CanvasIcon> iterator2 = iterator = a2.c.values().iterator();
                while (iterator2.hasNext()) {
                    ScreenSpaceCanvas.CanvasIcon canvasIcon = iterator.next();
                    iterator2 = iterator;
                    a2.b.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
                }
            }
            a2.c.clear();
            return;
        }
    }

    public int E() {
        pd_2 a2;
        return a2.c.size();
    }

    public void E(String a2) {
        pd_2 a3;
        Object object = a3.M;
        synchronized (object) {
            a2 = a3.c.remove(a2);
            if (a2 != null && a3.b != null) {
                a3.b.removeShape((ScreenSpaceCanvas.CanvasShape)a2);
            }
            return;
        }
    }

    public void E() {
        pd_2 a2;
        pd_2 pd_22 = a2;
        pd_22.j();
        Object object = pd_22.M;
        synchronized (object) {
            if (a2.b == null) {
                return;
            }
            a2.b.dispose();
            a2.b = null;
            return;
        }
    }
}

