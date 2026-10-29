/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JTextField;

public class Ag
extends AbstractAction {
    public static final long b = 8128747958723877L;
    public final /* synthetic */ JTextField c;

    public /* synthetic */ Ag(String a2, JTextField a3) {
        Ag a4;
        a4.c = a3;
        super(a2);
    }

    @Override
    public /* synthetic */ void actionPerformed(ActionEvent a2) {
        Ag a3;
        a3.c.paste();
    }
}

