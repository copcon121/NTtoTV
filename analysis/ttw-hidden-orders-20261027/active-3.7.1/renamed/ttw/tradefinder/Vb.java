/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.TimerTask;
import ttw.tradefinder.cd;
import ttw.tradefinder.wa_1;

public class Vb
extends TimerTask {
    public final /* synthetic */ wa_1 c;

    public /* synthetic */ Vb(wa_1 a2) {
        Vb a3;
        a3.c = a2;
    }

    @Override
    public /* synthetic */ void run() {
        Vb a2;
        if (a2.c.b != cd.b) {
            return;
        }
        Vb vb = a2;
        vb.c.E(vb.c.b, true);
    }
}

