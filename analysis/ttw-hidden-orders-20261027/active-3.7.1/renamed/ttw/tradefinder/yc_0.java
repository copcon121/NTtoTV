/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.event.HyperlinkEvent;
import javax.swing.event.HyperlinkListener;
import ttw.tradefinder.if_2;
import ttw.tradefinder.qc_1;

/*
 * Renamed from ttw.tradefinder.yc
 */
public class yc_0
implements HyperlinkListener {
    public final /* synthetic */ qc_1 c;

    @Override
    public /* synthetic */ void hyperlinkUpdate(HyperlinkEvent a2) {
        if (a2.getEventType() == HyperlinkEvent.EventType.ACTIVATED) {
            if_2.E(a2.getURL().toString());
        }
    }

    public /* synthetic */ yc_0(qc_1 a2) {
        yc_0 a3;
        a3.c = a2;
    }
}

