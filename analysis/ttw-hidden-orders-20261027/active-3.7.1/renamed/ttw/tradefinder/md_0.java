/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.Frame;
import javax.swing.JDialog;
import javax.swing.JFrame;
import ttw.tradefinder.f_0;
import ttw.tradefinder.sa_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Md
 */
public class md_0
extends JDialog {
    private final sa_1 b;
    public static final long c = 74148236912335L;

    public void j() {
        md_0 a2;
        md_0 md_02 = a2;
        md_02.b.void_d();
        md_0 md_03 = a2;
        Dimension dimension = md_02.b.getLayout().preferredLayoutSize(md_03);
        super.setSize(new Dimension(Math.max(dimension.width, 400), dimension.height + 20));
    }

    public md_0(String a2, ze_2 a3, f_0 a4, JFrame a5) {
        super((Frame)a5, a3.M + " - Price Alerts");
        md_0 a6;
        md_0 md_02 = a6;
        md_02.b = new sa_1((String)a2, a3, a4);
        super.setContentPane(md_02.b);
        a2 = md_02.b.getLayout().preferredLayoutSize(a6);
        super.setSize(new Dimension(Math.max(((Dimension)a2).width, 400), ((Dimension)a2).height + 30));
        super.setModalExclusionType(Dialog.ModalExclusionType.APPLICATION_EXCLUDE);
        super.setModalityType(Dialog.ModalityType.MODELESS);
        super.setDefaultCloseOperation(1);
        super.setAlwaysOnTop(true);
    }

    public void E() {
        md_0 a2;
        md_0 md_02 = a2;
        super.dispose();
        md_02.b.void_A();
    }
}

