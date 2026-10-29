/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.gui.colors.Colors
 */
package velox.indicators.sionchart.b;

import java.awt.Component;
import java.awt.event.ActionEvent;
import javax.swing.JButton;
import javax.swing.JPopupMenu;
import velox.gui.colors.Colors;
import velox.indicators.sionchart.b.q;

public class j
extends JButton {
    private static final long a = -2907020560411596119L;
    private final String b;

    public j(String string, String string2) {
        super(string);
        this.b = string2;
        this.addActionListener(this::a);
    }

    private void a(ActionEvent actionEvent) {
        JPopupMenu jPopupMenu = new JPopupMenu();
        jPopupMenu.setBackground(Colors.TRANSPARENT);
        jPopupMenu.add((Component)new q(this.b), 0);
        jPopupMenu.show(this, 0, this.getHeight());
    }
}

