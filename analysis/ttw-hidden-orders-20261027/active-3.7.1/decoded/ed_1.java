/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener
 *  velox.api.layer1.layers.strategies.interfaces.InvalidateInterface
 *  velox.api.layer1.messages.indicators.IndicatorLineStyle
 */
package ttw.tradefinder;

import java.util.function.Consumer;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.f_0;
import ttw.tradefinder.s_0;
import ttw.tradefinder.se_1;
import ttw.tradefinder.u_0;
import ttw.tradefinder.xb_2;
import ttw.tradefinder.ze_2;
import velox.api.layer1.layers.strategies.interfaces.CalculatedResultListener;
import velox.api.layer1.layers.strategies.interfaces.InvalidateInterface;
import velox.api.layer1.messages.indicators.IndicatorLineStyle;

/*
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ttw.tradefinder.Ed
 */
public abstract class ed_1
extends xb_2
implements u_0 {
    private InvalidateInterface E;
    private boolean j;
    private final Object a;
    private final boolean h;
    private long H;
    private Consumer<Object> D;
    private se_1 A;
    private Boolean C;
    private static int M = 2000000;
    private Double b;
    private static int c = 600000;

    public IndicatorLineStyle E() {
        return IndicatorLineStyle.DEFAULT;
    }

    @Override
    public void E() {
        ed_1 a2;
        ed_1 ed_12 = a2;
        super.E();
        ed_12.b = Double.NaN;
        ed_12.H = 0L;
    }

    private /* synthetic */ Pair<Long, Double> E(long a22) {
        ed_1 a3;
        se_1 se_12 = a3.A;
        synchronized (se_12) {
            int a22 = a3.A.E(a22);
            if (a22 == -1) {
                return null;
            }
            return Pair.of((Object)a3.A.E(a22), (Object)a3.A.E(a22));
        }
    }

    public Consumer<Object> E() {
        ed_1 a2;
        Object object = a2.a;
        synchronized (object) {
            return a2.D;
        }
    }

    @Override
    public void E(long a2, long a3, int a4, CalculatedResultListener a5) {
        int n2;
        ed_1 a6;
        if (!a6.C.booleanValue()) {
            a5.setCompleted();
            return;
        }
        long l2 = 0L;
        int n3 = n2 = 1;
        while (n3 <= a4) {
            long l3 = a2 + a3 * (long)n2;
            if (a5.isCancelled()) break;
            Pair<Long, Double> pair = a6.E(l3);
            if (pair != null) {
                l2 = (Long)pair.getKey();
                a5.provideResponse(pair.getValue());
            } else {
                a5.provideResponse(null);
            }
            n3 = ++n2;
        }
        a6.H = l2;
        a5.setCompleted();
    }

    @Override
    public boolean E() {
        ed_1 a2;
        return a2.C;
    }

    @Override
    public void E(Consumer<Object> a2, InvalidateInterface a3) {
        ed_1 a4;
        Object object = a4.a;
        synchronized (object) {
            a4.D = a2;
            a4.E = a3;
            return;
        }
    }

    @Override
    public void E(boolean a22) {
        ed_1 ed_12;
        ed_1 a3;
        if (a22) {
            se_1 a22 = a3.A;
            synchronized (a22) {
                a3.A.j();
                a3.b = Double.NaN;
                // MONITOREXIT @DISABLED, blocks:[0, 1, 5] lbl7 : MonitorExitStatement: MONITOREXIT : a
                ed_12 = a3;
            }
        } else {
            ed_12 = a3;
        }
        InvalidateInterface a22 = ed_12.E();
        if (a22 != null) {
            a22.invalidate();
        }
    }

    public void a() {
        ed_1 a2;
        a2.j = true;
        a2.E(false);
    }

    @Override
    public void j(long a2) {
        ed_1 a3;
        ed_1 ed_12 = a3;
        ed_12.b = Double.NaN;
        ed_12.H = 0L;
    }

    @Override
    public void j() {
        ed_1 a2;
        ed_1 ed_12 = a2;
        super.j();
        ed_12.E(true);
    }

    public ed_1(f_0 a2, ze_2 a3, s_0 a4) {
        ed_1 a5;
        ed_1 ed_12 = a5;
        ed_1 ed_13 = a5;
        ed_1 ed_14 = a5;
        ed_1 ed_15 = a5;
        super(a2, a3, a4);
        ed_15.a = new Object();
        ed_15.A = new se_1(c, M, true);
        ed_15.D = null;
        ed_14.E = null;
        ed_14.b = Double.NaN;
        ed_14.C = Boolean.FALSE;
        ed_13.H = 0L;
        ed_13.j = false;
        ed_12.h = a2.j();
        ed_12.j = false;
    }

    public InvalidateInterface E() {
        ed_1 a2;
        Object object = a2.a;
        synchronized (object) {
            return a2.E;
        }
    }

    public void E(double a2, long a3) {
        ed_1 ed_12;
        ed_1 a4;
        if (Double.isNaN(a4.b)) {
            a4.b = a2;
            ed_12 = a4;
        } else {
            if (a4.b == a2) {
                return;
            }
            ed_12 = a4;
        }
        ed_12.b = a2;
        Consumer<Object> consumer = a4.A;
        synchronized (consumer) {
            a4.A.E(a3, a2);
        }
        if (!a4.h) {
            return;
        }
        if (!a4.j) {
            return;
        }
        if (!a4.C.booleanValue()) {
            return;
        }
        consumer = a4.E();
        if (consumer == null) {
            return;
        }
        consumer.accept(a2);
    }

    public boolean j() {
        return false;
    }

    @Override
    public void E(long a22) {
        ed_1 a3;
        if (!a3.C.booleanValue() || a3.h) {
            return;
        }
        Object a22 = a3.E(a22);
        if (a22 != null && a3.H != (Long)a22.getKey()) {
            a3.H = (Long)a22.getKey();
            a22 = a22.getValue();
            Consumer<Object> consumer = a3.E();
            if (consumer == null) {
                return;
            }
            consumer.accept(a22);
        }
    }

    public void a(boolean a2) {
        ed_1 a3;
        if (a3.C == a2) {
            return;
        }
        boolean bl = a2;
        a3.C = bl;
        a3.j(bl);
    }
}

