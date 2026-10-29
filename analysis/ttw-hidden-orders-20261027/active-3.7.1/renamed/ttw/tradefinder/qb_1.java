/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.TimerTask;
import ttw.tradefinder.qc_1;
import ttw.tradefinder.ub_1;

/*
 * Renamed from ttw.tradefinder.Qb
 */
public class qb_1
extends TimerTask {
    public final /* synthetic */ qc_1 c;

    @Override
    public /* synthetic */ void run() {
        qb_1 a2;
        boolean bl = false;
        if (++a2.c.k >= 10) {
            a2.c.k = 0;
            bl = true;
        }
        boolean bl2 = false;
        if (++a2.c.h >= 5) {
            a2.c.h = 0;
            bl2 = true;
        }
        for (ub_1 ub_12 : a2.c.i.values()) {
            if (!bl && (!bl2 || !ub_12.boolean_E())) continue;
            a2.c.D.E(ub_12);
        }
    }

    public /* synthetic */ qb_1(qc_1 a2) {
        qb_1 a3;
        a3.c = a2;
    }
}

