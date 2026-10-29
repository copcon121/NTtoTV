/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Container;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ob_1;
import ttw.tradefinder.rd_0;
import ttw.tradefinder.ua_0;
import ttw.tradefinder.wc_1;
import ttw.tradefinder.yc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.Nc
 */
public class nc_2
implements ActionListener {
    public final /* synthetic */ ze_2 C;
    public final /* synthetic */ yc_2 M;
    public final /* synthetic */ df_0 b;
    public final /* synthetic */ ob_1 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ nc_2(ob_1 a2, df_0 a3, ze_2 a4, yc_2 a5) {
        nc_2 a6;
        nc_2 nc_22 = a6;
        nc_22.c = a2;
        nc_22.b = a3;
        a6.C = a4;
        a6.M = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        nc_2 a3;
        if (((ua_0)a3.b.M).D == df_1.c) {
            return;
        }
        a2 = a3.c.M;
        synchronized (a2) {
            if (a3.c.C.containsKey(a3.C.M)) {
                JDialog jDialog = a3.c.C.get(a3.C.M);
                jDialog.setVisible(true);
                jDialog.toFront();
                return;
            }
        }
        a2 = new JOptionPane();
        Window window = new JFrame();
        window.setType(Window.Type.UTILITY);
        JFrame jFrame = window;
        jFrame.setUndecorated(true);
        window = ((JOptionPane)a2).createDialog(jFrame, a3.C.M + " - HOT Navigator");
        nc_2 nc_22 = a3;
        a2 = new wc_1(nc_22.C, nc_22.M);
        Object object = a3.c.M;
        synchronized (object) {
            a3.c.C.put(a3.C.M, (JDialog)window);
            Window window2 = window;
            Window window3 = window;
            ((JDialog)window).setContentPane((Container)a2);
            window3.addComponentListener(new rd_0(a3, (wc_1)a2));
            a2 = ((Container)a2).getLayout().preferredLayoutSize(window);
            window2.setSize(new Dimension(Math.max(((Dimension)a2).width, 400), ((Dimension)a2).height));
            ((Dialog)window3).setModalityType(Dialog.ModalityType.MODELESS);
            window2.setModalExclusionType(Dialog.ModalExclusionType.APPLICATION_EXCLUDE);
            ((JDialog)window2).setDefaultCloseOperation(1);
            window2.setAlwaysOnTop(true);
            ((Dialog)window2).setVisible(true);
            window2.toFront();
            return;
        }
    }
}

