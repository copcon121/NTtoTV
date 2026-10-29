/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Iterator;
import javax.swing.JDialog;
import ttw.tradefinder.K;
import ttw.tradefinder.g_0;
import ttw.tradefinder.la_2;

/*
 * Renamed from ttw.tradefinder.Ab
 */
public class ab_2
implements g_0 {
    public final /* synthetic */ la_2 c;

    public /* synthetic */ ab_2(la_2 a2) {
        ab_2 a3;
        a3.c = a2;
    }

    @Override
    public void E(K a2, boolean a3, boolean a42) {
        if (a42 && !a3) {
            ab_2 a5;
            a2 = a5.c.b;
            synchronized (a2) {
                Iterator<JDialog> iterator = a3 = a5.c.M.values().iterator();
                while (iterator.hasNext()) {
                    JDialog a42 = a3.next();
                    a42.dispose();
                    iterator = a3;
                }
                a5.c.M.clear();
                return;
            }
        }
    }
}

