/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.colors.ColorsChangedListener
 */
package ttw.tradefinder;

import ttw.tradefinder.sB;
import velox.colors.ColorsChangedListener;

public class wc
implements ColorsChangedListener {
    public final /* synthetic */ sB c;

    public /* synthetic */ wc(sB a2) {
        wc a3;
        a3.c = a2;
    }

    public void onColorsChanged() {
        wc a2;
        a2.c.c.repaint();
    }
}

