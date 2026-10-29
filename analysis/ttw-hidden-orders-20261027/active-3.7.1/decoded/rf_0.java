/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JTextField;

/*
 * Renamed from ttw.tradefinder.rf
 */
public class rf_0
extends AbstractAction {
    public static final long b = 8128747958723878L;
    public final /* synthetic */ JTextField c;

    @Override
    public /* synthetic */ void actionPerformed(ActionEvent a2) {
        rf_0 a3;
        a3.c.selectAll();
    }

    public /* synthetic */ rf_0(String a2, JTextField a3) {
        rf_0 a4;
        a4.c = a3;
        super(a2);
    }
}

