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
import ttw.tradefinder.dc_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ec_2;
import ttw.tradefinder.ic_2;
import ttw.tradefinder.la_2;
import ttw.tradefinder.oc_2;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.mA
 */
public class ma_1
implements ActionListener {
    public final /* synthetic */ df_0 C;
    public final /* synthetic */ la_2 M;
    public final /* synthetic */ ze_2 b;
    public final /* synthetic */ oc_2 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ma_1(la_2 a2, ze_2 a3, oc_2 a4, df_0 a5) {
        ma_1 a6;
        ma_1 ma_12 = a6;
        ma_12.M = a2;
        ma_12.b = a3;
        a6.c = a4;
        a6.C = a5;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        ma_1 a3;
        a2 = a3.M.b;
        synchronized (a2) {
            if (a3.M.M.containsKey(a3.b.M)) {
                JDialog jDialog = a3.M.M.get(a3.b.M);
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
        window = ((JOptionPane)a2).createDialog(jFrame, a3.b.M + " - Live View");
        ma_1 ma_12 = a3;
        a2 = new ec_2(ma_12.b, ma_12.c, (float)((dc_2)a3.C.M).c / 10.0f);
        Object object = a3.M.b;
        synchronized (object) {
            a3.M.M.put(a3.b.M, (JDialog)window);
            Window window2 = window;
            Window window3 = window;
            ((JDialog)window).setContentPane((Container)a2);
            window3.addComponentListener(new ic_2(a3));
            a2 = ((Container)a2).getLayout().preferredLayoutSize(window);
            window2.setSize(new Dimension(Math.max(((Dimension)a2).width, 260), ((Dimension)a2).height));
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

