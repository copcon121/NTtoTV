/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.TradeInfo
 */
package ttw.tradefinder;

import java.lang.ref.WeakReference;
import ttw.tradefinder.x_0;
import velox.api.layer1.data.TradeInfo;

/*
 * Duplicate member names - consider using --renamedupmembers true
 */
public class yd {
    private final WeakReference<x_0> c;

    public void j() {
        yd a2;
        if (a2.c.get() != null) {
            a2.c.clear();
        }
    }

    public boolean E(x_0 a2) {
        yd a3;
        if (a3.c.get() == null) {
            return true;
        }
        return a3.c.get() == a2;
    }

    public void E(long a2, String a3, int a4, int a5, boolean a6) {
        yd a7;
        if (a7.c.get() == null) {
            return;
        }
        ((x_0)a7.c.get()).E(a2, a3, a4, a5, a6);
    }

    public void E() {
        yd a2;
        if (a2.c.get() == null) {
            return;
        }
        ((x_0)a2.c.get()).a();
    }

    public void E(long a2, int a3, int a4, TradeInfo a5) {
        yd a6;
        if (a6.c.get() == null) {
            return;
        }
        ((x_0)a6.c.get()).E(a2, a3, a4, a5);
    }

    public void E(long a2, String a3, int a4, int a5) {
        yd a6;
        if (a6.c.get() == null) {
            return;
        }
        ((x_0)a6.c.get()).E(a2, a3, a4, a5);
    }

    public void E(long a2) {
        yd a3;
        if (a3.c.get() == null) {
            return;
        }
        ((x_0)a3.c.get()).d(a2);
    }

    public yd(x_0 a2) {
        yd a3;
        a3.c = new WeakReference<x_0>(a2);
    }

    public void E(long a2, String a3) {
        yd a4;
        if (a4.c.get() == null) {
            return;
        }
        ((x_0)a4.c.get()).E(a2, a3);
    }

    public boolean E() {
        yd a2;
        return a2.c.get() == null;
    }

    public void E(long a2, int a3, int a4, boolean a5) {
        yd a6;
        if (a6.c.get() == null) {
            return;
        }
        ((x_0)a6.c.get()).E(a2, a3, a4, a5);
    }
}

