/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.sound.sampled.LineEvent;
import javax.sound.sampled.LineListener;
import ttw.tradefinder.he_2;

/*
 * Renamed from ttw.tradefinder.we
 */
public class we_2
implements LineListener {
    public final /* synthetic */ he_2 c;

    public /* synthetic */ we_2(he_2 a2) {
        we_2 a3;
        a3.c = a2;
    }

    @Override
    public void update(LineEvent a2) {
        if (((LineEvent)a2).getType() == LineEvent.Type.STOP) {
            a2 = ((LineEvent)a2).getLine();
            a2.close();
        }
    }
}

