/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  org.apache.commons.lang3.tuple.Triple
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.Ic;
import ttw.tradefinder.Jd;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.fC;
import ttw.tradefinder.he_1;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.re_1;
import velox.gui.colors.Colors;

public class dc {
    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ Pair<Integer, Integer> E(Ic a2, eC a3, float a4) {
        if (a2 == Ic.A) {
            a2 = (double)a4 <= 1.2 ? Ic.C : ((double)a4 <= 2.0 ? Ic.b : ((double)a4 <= 4.0 ? Ic.H : Ic.c));
        }
        switch (a3) {
            case D: 
            case M: {
                switch (a2) {
                    case D: {
                        return Pair.of((Object)9, (Object)11);
                    }
                    case C: {
                        return Pair.of((Object)11, (Object)13);
                    }
                    case b: {
                        return Pair.of((Object)17, (Object)20);
                    }
                    case H: {
                        return Pair.of((Object)23, (Object)28);
                    }
                    case c: {
                        return Pair.of((Object)27, (Object)34);
                    }
                }
                return Pair.of((Object)17, (Object)20);
            }
            case H: 
            case c: {
                switch (a2) {
                    case D: {
                        return Pair.of((Object)6, (Object)6);
                    }
                    case C: {
                        return Pair.of((Object)10, (Object)10);
                    }
                    case b: {
                        return Pair.of((Object)15, (Object)15);
                    }
                    case H: {
                        return Pair.of((Object)22, (Object)22);
                    }
                    case c: {
                        return Pair.of((Object)30, (Object)30);
                    }
                }
                return Pair.of((Object)15, (Object)15);
            }
            case C: 
            case b: {
                switch (a2) {
                    case D: {
                        return Pair.of((Object)8, (Object)7);
                    }
                    case C: {
                        return Pair.of((Object)10, (Object)9);
                    }
                    case b: {
                        return Pair.of((Object)15, (Object)13);
                    }
                    case H: {
                        return Pair.of((Object)22, (Object)19);
                    }
                    case c: {
                        return Pair.of((Object)30, (Object)26);
                    }
                }
                return Pair.of((Object)15, (Object)13);
            }
            case A: {
                switch (a2) {
                    case D: {
                        return Pair.of((Object)10, (Object)2);
                    }
                    case C: {
                        return Pair.of((Object)15, (Object)3);
                    }
                    case b: {
                        return Pair.of((Object)22, (Object)4);
                    }
                    case H: {
                        return Pair.of((Object)30, (Object)5);
                    }
                    case c: {
                        return Pair.of((Object)36, (Object)5);
                    }
                }
                return Pair.of((Object)22, (Object)3);
            }
            case a: {
                switch (a2) {
                    case D: {
                        return Pair.of((Object)2, (Object)10);
                    }
                    case C: {
                        return Pair.of((Object)3, (Object)15);
                    }
                    case b: {
                        return Pair.of((Object)4, (Object)22);
                    }
                    case H: {
                        return Pair.of((Object)5, (Object)30);
                    }
                    case c: {
                        return Pair.of((Object)5, (Object)36);
                    }
                }
                return Pair.of((Object)4, (Object)15);
            }
        }
        return Pair.of((Object)15, (Object)15);
    }

    /*
     * Enabled aggressive block sorting
     */
    public static int E(fC a2, int a3, float a4) {
        switch (a2.b) {
            case M: {
                return 50;
            }
            case b: {
                return 25;
            }
            case D: {
                return -25 - a3;
            }
            case A: {
                return -50 - a3;
            }
        }
        Pair<Integer, Integer> pair = a2;
        a2 = dc.E(pair.c, pair.D, a4);
        return -((Integer)a2.getRight() / 2);
    }

    private static /* synthetic */ BufferedImage j(fC a2, Jd a3) {
        Font font;
        String string;
        if (a3.E(a2.C == df_1.c)) {
            return new BufferedImage(1, 1, 2);
        }
        Font font2 = new Font(re_1.E("piXz]"), 0, a2.A);
        Triple<Integer, Integer, Integer> triple = dc.E(a3.E(), font2);
        if (a2.C == df_1.c) {
            string = a3.j();
            font = font2;
        } else {
            string = "";
            font = font2;
        }
        Triple<Integer, Integer, Integer> triple2 = dc.E(string, font);
        int n2 = Math.max((Integer)triple.getLeft(), (Integer)triple2.getLeft()) + 6;
        int n3 = (Integer)triple.getMiddle() + (Integer)triple2.getMiddle() + 6;
        BufferedImage bufferedImage = new BufferedImage(n2, n3, 2);
        Graphics2D graphics2D = bufferedImage.createGraphics();
        graphics2D.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D2 = graphics2D;
        Graphics2D graphics2D3 = graphics2D;
        graphics2D.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D3.setFont(font2);
        graphics2D3.setColor(Colors.TRANSPARENT);
        graphics2D3.fillRect(0, 0, n2, n3);
        graphics2D2.setColor(he_1.E(he_1.D, a2.M));
        graphics2D2.fillRoundRect(0, 0, n2, n3, 5, 5);
        graphics2D2.setColor(he_1.E(he_1.H, a2.M));
        if (!a3.E().isEmpty()) {
            graphics2D.drawString(a3.E(), (bufferedImage.getWidth() - (Integer)triple.getLeft()) / 2, (Integer)triple.getRight() + 2);
        }
        if (a2.C == df_1.c && !a3.j().isEmpty()) {
            graphics2D.drawString(a3.j(), (bufferedImage.getWidth() - (Integer)triple2.getLeft()) / 2, (Integer)triple.getMiddle() + (Integer)triple2.getRight() + 4);
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    public static Triple<Integer, Integer, Integer> E(String a2, Font a3) {
        if (((String)a2).isEmpty()) {
            return Triple.of((Object)0, (Object)0, (Object)0);
        }
        Object object = new BufferedImage(1, 1, 2);
        object = ((BufferedImage)object).createGraphics();
        ((Graphics2D)object).setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Object object2 = object;
        Object object3 = object;
        ((Graphics2D)object3).setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        ((Graphics)object2).setFont((Font)a3);
        a3 = ((Graphics2D)object3).getFontRenderContext();
        a2 = ((Graphics)object2).getFont().createGlyphVector((FontRenderContext)a3, (String)a2);
        a2 = ((GlyphVector)a2).getPixelBounds((FontRenderContext)a3, 0.0f, 0.0f);
        a2 = Triple.of((Object)((int)((Rectangle)a2).getWidth()), (Object)((int)((Rectangle)a2).getHeight()), (Object)(-((Rectangle)a2).y));
        ((Graphics)object2).dispose();
        return a2;
    }

    public static BufferedImage E(fC a2, Jd a3) {
        Graphics2D graphics2D;
        if (((Jd)a3).E(a2.C == df_1.c)) {
            return dc.E(a2, ((Jd)a3).E());
        }
        fC fC2 = a2;
        BufferedImage bufferedImage = dc.j(fC2, (Jd)a3);
        a3 = dc.E(fC2, ((Jd)a3).E());
        BufferedImage bufferedImage2 = new BufferedImage(Math.max(bufferedImage.getWidth(), ((BufferedImage)a3).getWidth()), bufferedImage.getHeight() + ((BufferedImage)a3).getHeight() + 2, 2);
        Graphics2D graphics2D2 = bufferedImage2.createGraphics();
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        Graphics2D graphics2D3 = graphics2D2;
        if (dc.E(fC2.b)) {
            BufferedImage bufferedImage3 = bufferedImage;
            graphics2D3.drawImage((Image)bufferedImage3, (bufferedImage2.getWidth() - bufferedImage3.getWidth()) / 2, 0, null);
            Object object = a3;
            graphics2D2.drawImage((Image)object, (bufferedImage2.getWidth() - ((BufferedImage)object).getWidth()) / 2, bufferedImage.getHeight() + 2, null);
            graphics2D = graphics2D2;
        } else {
            graphics2D3.drawImage((Image)a3, (bufferedImage2.getWidth() - ((BufferedImage)a3).getWidth()) / 2, 0, null);
            BufferedImage bufferedImage4 = bufferedImage;
            graphics2D2.drawImage((Image)bufferedImage4, (bufferedImage2.getWidth() - bufferedImage4.getWidth()) / 2, ((BufferedImage)a3).getHeight() + 2, null);
            graphics2D = graphics2D2;
        }
        graphics2D.dispose();
        return bufferedImage2;
    }

    public static int E(eC a2, int a3) {
        return -(a3 / 2);
    }

    public static BufferedImage E(fC a2, float a2222) {
        Graphics2D graphics2D;
        fC fC2 = a2;
        Pair<Integer, Integer> a2222 = dc.E(fC2.c, fC2.D, a2222);
        int n2 = (Integer)a2222.getLeft();
        int a2222 = (Integer)a2222.getRight();
        BufferedImage bufferedImage = new BufferedImage(n2, a2222, 2);
        Graphics2D graphics2D2 = bufferedImage.createGraphics();
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics2D2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        if (a2.D == eC.D) {
            int n3 = a2222 / 3;
            int n4 = n2 / 4;
            Graphics2D graphics2D3 = graphics2D2;
            graphics2D = graphics2D3;
            Graphics2D graphics2D4 = graphics2D2;
            graphics2D4.setColor(Colors.TRANSPARENT);
            graphics2D4.fillRect(0, 0, n2 - 1, a2222 - 1);
            graphics2D3.setColor(a2.M);
            graphics2D3.fillPolygon(new int[]{0, n4, n4, n2 - n4 - 1, n2 - n4 - 1, n2 - 1, n2 / 2}, new int[]{n3, n3, a2222 - 1, a2222 - 1, n3, n3, 0}, 7);
        } else if (a2.D == eC.M) {
            int n5 = a2222 / 3;
            int n6 = n2 / 4;
            Graphics2D graphics2D5 = graphics2D2;
            graphics2D = graphics2D5;
            Graphics2D graphics2D6 = graphics2D2;
            graphics2D6.setColor(Colors.TRANSPARENT);
            graphics2D6.fillRect(0, 0, n2 - 1, a2222 - 1);
            graphics2D5.setColor(a2.M);
            graphics2D5.fillPolygon(new int[]{0, n6, n6, n2 - n6 - 1, n2 - n6 - 1, n2 - 1, n2 / 2}, new int[]{a2222 - n5, a2222 - n5, 0, 0, a2222 - n5, a2222 - n5, a2222 - 1}, 7);
        } else if (a2.D == eC.H) {
            Graphics2D graphics2D7 = graphics2D2;
            graphics2D = graphics2D7;
            Graphics2D graphics2D8 = graphics2D2;
            graphics2D8.setColor(Colors.TRANSPARENT);
            graphics2D8.fillRect(0, 0, n2 - 1, a2222 - 1);
            graphics2D7.setColor(a2.M);
            graphics2D7.fillOval(0, 0, n2 - 1, a2222 - 1);
        } else if (a2.D == eC.c || a2.D == eC.A || a2.D == eC.a) {
            graphics2D = graphics2D2;
            Graphics2D graphics2D9 = graphics2D2;
            graphics2D9.setColor(a2.M);
            graphics2D9.fillRect(0, 0, n2 - 1, a2222 - 1);
        } else if (a2.D == eC.C) {
            Graphics2D graphics2D10 = graphics2D2;
            graphics2D = graphics2D10;
            Graphics2D graphics2D11 = graphics2D2;
            graphics2D11.setColor(Colors.TRANSPARENT);
            graphics2D11.fillRect(0, 0, n2 - 1, a2222 - 1);
            graphics2D10.setColor(a2.M);
            graphics2D10.fillPolygon(new int[]{0, n2 - 1, n2 / 2}, new int[]{a2222 - 1, a2222 - 1, 0}, 3);
        } else if (a2.D == eC.b) {
            Graphics2D graphics2D12 = graphics2D2;
            graphics2D = graphics2D12;
            Graphics2D graphics2D13 = graphics2D2;
            graphics2D13.setColor(Colors.TRANSPARENT);
            graphics2D13.fillRect(0, 0, n2 - 1, a2222 - 1);
            graphics2D12.setColor(a2.M);
            graphics2D12.fillPolygon(new int[]{0, n2 - 1, n2 / 2}, new int[]{0, 0, a2222 - 1}, 3);
        } else {
            graphics2D = graphics2D2;
            Graphics2D graphics2D14 = graphics2D2;
            graphics2D14.setColor(Colors.TRANSPARENT);
            graphics2D14.fillRect(0, 0, 1, 1);
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ boolean E(lc_0 a2) {
        switch (a2) {
            case D: 
            case A: {
                return false;
            }
        }
        return true;
    }

    public dc() {
        dc a2;
    }

    public static BufferedImage E(fC a2) {
        return dc.E(a2, Jd.E().E());
    }
}

