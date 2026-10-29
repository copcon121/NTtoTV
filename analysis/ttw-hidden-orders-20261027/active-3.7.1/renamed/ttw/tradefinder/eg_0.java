/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.MouseEvent;
import javax.swing.event.MouseInputAdapter;
import ttw.tradefinder.cd;
import ttw.tradefinder.fa_2;
import ttw.tradefinder.if_2;
import ttw.tradefinder.zc_2;

/*
 * Renamed from ttw.tradefinder.Eg
 */
public class eg_0
extends MouseInputAdapter {
    public final /* synthetic */ fa_2 b;
    public final /* synthetic */ cd c;

    public /* synthetic */ eg_0(fa_2 a2, cd a3) {
        eg_0 a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public void mouseClicked(MouseEvent a2) {
        eg_0 a3;
        if_2.E(zc_2.a(a3.c));
    }
}

