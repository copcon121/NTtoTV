/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.awt.Component;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.image.BufferedImage;
import java.io.IOException;
import javax.imageio.ImageIO;
import javax.swing.ImageIcon;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSpinner;

public class k
extends JPanel {
    public k(JComponent jComponent, String string) {
        BufferedImage bufferedImage;
        try {
            bufferedImage = ImageIO.read(this.getClass().getResourceAsStream("/resources/icons/Information.png"));
        }
        catch (IOException iOException) {
            throw new RuntimeException("Error on icon file load: ", iOException);
        }
        catch (IllegalArgumentException illegalArgumentException) {
            return;
        }
        ImageIcon imageIcon = new ImageIcon(bufferedImage);
        JLabel jLabel = new JLabel(imageIcon);
        jLabel.setToolTipText(string);
        if (jComponent.getClass() != JPanel.class && jComponent.getClass() != JSpinner.class) {
            jComponent.setToolTipText(string);
        }
        this.setLayout(new GridBagLayout());
        GridBagConstraints gridBagConstraints = new GridBagConstraints();
        gridBagConstraints.fill = 2;
        gridBagConstraints.anchor = 13;
        gridBagConstraints.weightx = 1.0;
        this.add((Component)jComponent, gridBagConstraints);
        gridBagConstraints.weightx = 0.0;
        ++gridBagConstraints.gridy;
        this.add((Component)jLabel, gridBagConstraints);
    }
}

