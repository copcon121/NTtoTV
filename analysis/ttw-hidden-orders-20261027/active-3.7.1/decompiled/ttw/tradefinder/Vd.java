/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JTextField;

public class Vd
extends AbstractAction {
    public static final long b = 8128747958723876L;
    public final /* synthetic */ JTextField c;

    @Override
    public /* synthetic */ void actionPerformed(ActionEvent a2) {
        Vd a3;
        a3.c.cut();
    }

    public /* synthetic */ Vd(String a2, JTextField a3) {
        Vd a4;
        a4.c = a3;
        super(a2);
    }
}

