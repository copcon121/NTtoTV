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
import ttw.tradefinder.Oc;
import ttw.tradefinder.of_0;
import ttw.tradefinder.vE;

/*
 * Renamed from ttw.tradefinder.iE
 */
public class ie_2
implements ActionListener {
    public final /* synthetic */ JButton M;
    public final /* synthetic */ JLabel b;
    public final /* synthetic */ of_0 c;

    @Override
    public void actionPerformed(ActionEvent a2) {
        JFileChooser jFileChooser;
        JFileChooser jFileChooser2;
        ie_2 a3;
        a2 = null;
        try {
            a2 = UIManager.getLookAndFeel();
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        }
        catch (Exception exception) {}
        Serializable serializable = new File(a3.c.a.a());
        if (!((File)serializable).exists()) {
            serializable = new File(a3.c.a.java_lang_String_E());
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
        ((JFileChooser)serializable2).setFileFilter(new FileNameExtensionFilter(Oc.E("f\u000b@\nQDs\rY\u0001FD\u001dN\u001b\u0013T\u0012\u001c"), vE.E("\f6\r")));
        if (((JFileChooser)serializable).showDialog(a3.M, Oc.E("7P\bP\u0007A")) == 0) {
            serializable = ((JFileChooser)serializable).getSelectedFile();
            a3.b.setText("Ask - " + ((File)serializable).getName());
            ie_2 ie_22 = a3;
            ie_22.b.setToolTipText(((File)serializable).getAbsolutePath());
            ie_22.c.a.j(((File)serializable).getAbsolutePath());
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

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ ie_2(of_0 a2, JButton a3, JLabel a4) {
        ie_2 a5;
        a5.c = a2;
        a5.M = a3;
        a5.b = a4;
    }
}

