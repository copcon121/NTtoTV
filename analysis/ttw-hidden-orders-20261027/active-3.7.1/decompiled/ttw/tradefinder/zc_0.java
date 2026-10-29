/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import javax.swing.JPanel;
import ttw.tradefinder.Jd;
import ttw.tradefinder.Q;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.dc;
import ttw.tradefinder.fC;
import ttw.tradefinder.gd_2;

/*
 * Renamed from ttw.tradefinder.zc
 */
public class zc_0
extends JPanel {
    private BufferedImage M;
    public static final long b = 78147634812335L;
    private Q c;

    @Override
    public void paint(Graphics a22) {
        zc_0 a3;
        a22.drawImage(a3.M, 0, 0, a3);
        fC fC2 = new fC(a3.c.E(), a3.c.E(), a3.c.E(), a3.c.E(), a3.c.E(), a3.c.E());
        BufferedImage bufferedImage = dc.E(fC2, Jd.E());
        zc_0 zc_02 = a3;
        int a22 = zc_02.M.getWidth() / 2;
        int n2 = zc_02.M.getHeight() / 2;
        BufferedImage bufferedImage2 = bufferedImage;
        a22.drawImage(bufferedImage2, a22 + dc.E(fC2.D, bufferedImage2.getWidth()), n2 - dc.E(fC2, bufferedImage.getHeight(), Jd.E().E()) - bufferedImage.getHeight(), a3);
    }

    public zc_0(Q a2) {
        zc_0 zc_02;
        zc_0 a3;
        try {
            a3.M = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(gd_2.E("8~0t4`~~0a:v%=!}6")));
            zc_02 = a3;
        }
        catch (Exception exception) {
            zc_02 = a3;
            a3.M = new BufferedImage(1, 1, 2);
        }
        zc_02.c = a2;
        zc_0 zc_03 = a3;
        zc_03.setPreferredSize(new Dimension(zc_03.M.getWidth(), a3.M.getHeight()));
        zc_03.setMinimumSize(new Dimension(a3.M.getWidth(), a3.M.getHeight()));
        zc_0 zc_04 = a3;
        zc_04.setMaximumSize(new Dimension(zc_04.M.getWidth(), a3.M.getHeight()));
    }
}

