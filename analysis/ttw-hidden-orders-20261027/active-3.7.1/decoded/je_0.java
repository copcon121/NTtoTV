/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import ttw.tradefinder.Oc;
import ttw.tradefinder.af_0;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.cc_0;

/*
 * Renamed from ttw.tradefinder.Je
 */
public class je_0 {
    private static final Map<af_0, BufferedImage> c = je_0.E();

    public static /* synthetic */ BufferedImage E(af_0 a2, int a3, int a4) {
        if (!c.containsKey((Object)a2)) {
            return new BufferedImage(1, 1, 2);
        }
        BufferedImage bufferedImage = new BufferedImage(a3, a4, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        graphics2D2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D2.drawImage(c.get((Object)a2), 0, 0, a3, a4, null);
        graphics2D.dispose();
        return bufferedImage;
    }

    public static /* synthetic */ BufferedImage E(af_0 a2) {
        if (!c.containsKey((Object)a2)) {
            return new BufferedImage(1, 1, 2);
        }
        return c.get((Object)a2);
    }

    private static /* synthetic */ void E(Map<af_0, BufferedImage> a2, af_0 a3, String a4) {
        try {
            a4 = ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream((String)a4));
            a2.put(a3, (BufferedImage)a4);
            return;
        }
        catch (Exception exception) {
            return;
        }
    }

    private static /* synthetic */ Map<af_0, BufferedImage> E() {
        HashMap<af_0, BufferedImage> hashMap = new HashMap<af_0, BufferedImage>();
        hashMap.put(af_0.B, new BufferedImage(1, 1, 2));
        HashMap<af_0, BufferedImage> hashMap2 = hashMap;
        je_0.E(hashMap2, af_0.h, "symbols/snowcappedmountain.png");
        je_0.E(hashMap2, af_0.K, "symbols/runner.png");
        je_0.E(hashMap2, af_0.j, "symbols/broom.png");
        je_0.E(hashMap2, af_0.c, "symbols/balancescale.png");
        je_0.E(hashMap2, af_0.H, "symbols/chequeredflag.png");
        je_0.E(hashMap2, af_0.M, "symbols/moneybag.png");
        je_0.E(hashMap2, af_0.b, "symbols/stop.png");
        je_0.E(hashMap2, af_0.E, "symbols/liquidity.png");
        je_0.E(hashMap2, af_0.C, "symbols/pricealert.png");
        je_0.E(hashMap2, af_0.a, "symbols/explorer.png");
        je_0.E(hashMap2, af_0.D, "symbols/hiddenorder.png");
        je_0.E(hashMap2, af_0.k, "symbols/speedmeter.png");
        return hashMap;
    }

    public /* synthetic */ je_0() {
        je_0 a2;
    }
}

