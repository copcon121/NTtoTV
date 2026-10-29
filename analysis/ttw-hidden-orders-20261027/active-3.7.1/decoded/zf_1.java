/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import javax.swing.JTextField;

/*
 * Renamed from ttw.tradefinder.Zf
 */
public class zf_1
extends JTextField {
    private final String b;
    private static final long c = -2573085572512384691L;

    public /* synthetic */ void E(String a2) {
        zf_1 a3;
        zf_1 zf_12 = a3;
        zf_12.setText(zf_12.b + a2);
    }

    public /* synthetic */ zf_1(String a2, String a3) {
        super(a3 + a2);
        zf_1 a4;
        a4.b = a3;
        a4.setEditable(false);
    }
}

