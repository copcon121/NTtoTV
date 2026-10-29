/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.b;

import java.awt.Cursor;
import javax.swing.JLabel;
import velox.indicators.sionchart.b.m;

public class l
extends JLabel {
    public l(String string, String string2, String string3, String string4) {
        this.setText("<html>" + string + "<font color=#FFFFFF><a href=\"\">" + string2 + "</a></font>" + string3 + "</html>");
        this.setCursor(new Cursor(12));
        this.addMouseListener(new m(this, string4));
    }

    public l(String string, String string2) {
        this("", string, "", string2);
    }

    public l(String string, String string2, String string3) {
        this(string, string2, "", string3);
    }
}

