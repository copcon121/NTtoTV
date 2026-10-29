/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.Serializable;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.LookAndFeel;
import javax.swing.UIManager;
import javax.swing.filechooser.FileNameExtensionFilter;
import ttw.tradefinder.bC;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.of_0;

/*
 * Renamed from ttw.tradefinder.Vf
 */
public class vf_2
implements ActionListener {
    public final /* synthetic */ JButton M;
    public final /* synthetic */ JLabel b;
    public final /* synthetic */ of_0 c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ vf_2(of_0 a2, JButton a3, JLabel a4) {
        vf_2 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }

    @Override
    public void actionPerformed(ActionEvent a2) {
        JFileChooser jFileChooser;
        JFileChooser jFileChooser2;
        vf_2 a3;
        a2 = null;
        try {
            a2 = UIManager.getLookAndFeel();
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        }
        catch (Exception exception) {}
        Serializable serializable = new File(a3.c.a.E());
        if (!((File)serializable).exists()) {
            serializable = new File(a3.c.a.a());
        }
        if (((File)serializable).exists()) {
            jFileChooser = jFileChooser2;
            jFileChooser2 = new JFileChooser((File)serializable);
        } else {
            jFileChooser = jFileChooser2;
            jFileChooser2 = new JFileChooser();
        }
        serializable = jFileChooser;
        jFileChooser.setFileSelectionMode(0);
        Serializable serializable2 = serializable;
        ((JFileChooser)serializable2).setAcceptAllFileFilterUsed(false);
        ((JFileChooser)serializable2).setFileFilter(new FileNameExtensionFilter(gb_1.E("\u0012\n4\u000b%E\u0007\f-\u00002EiOo\u0012 \u0013h"), bC.E("ich")));
        if (((JFileChooser)serializable).showDialog(a3.M, gb_1.E("6$\t$\u00065")) == 0) {
            serializable = ((JFileChooser)serializable).getSelectedFile();
            a3.b.setText("Bid - " + ((File)serializable).getName());
            vf_2 vf_22 = a3;
            vf_22.b.setToolTipText(((File)serializable).getAbsolutePath());
            vf_22.c.a.E(((File)serializable).getAbsolutePath());
        }
        try {
            if (a2 != null) {
                UIManager.setLookAndFeel((LookAndFeel)a2);
            }
            return;
        }
        catch (Exception exception) {
            return;
        }
    }
}

