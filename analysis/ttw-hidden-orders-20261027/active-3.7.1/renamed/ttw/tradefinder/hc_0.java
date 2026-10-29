/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.Ic;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cC;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.da_1;
import ttw.tradefinder.dc;
import ttw.tradefinder.df_1;
import ttw.tradefinder.eC;
import ttw.tradefinder.fC;
import ttw.tradefinder.he_1;
import ttw.tradefinder.je_0;
import ttw.tradefinder.lc_0;
import ttw.tradefinder.ub;
import ttw.tradefinder.wB;
import ttw.tradefinder.xa_1;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.hc
 */
public class hc_0 {
    public static BufferedImage E(da_1 a2, af_0 a3) {
        Graphics2D graphics2D;
        Graphics2D graphics2D2;
        Graphics2D graphics2D3;
        Object object;
        BufferedImage bufferedImage;
        da_1 da_12;
        da_1 da_13 = a2;
        Color color = he_1.j(da_13.A, da_13.D);
        int n2 = 0;
        int n3 = 0;
        switch (a2.h) {
            case b: {
                while (false) {
                }
                n2 = 40;
                n3 = 20;
                da_12 = a2;
                break;
            }
            case c: {
                n2 = 20;
                n3 = 30;
            }
            default: {
                da_12 = a2;
            }
        }
        if (da_12.c == xa_1.b) {
            bufferedImage = a2.C == wB.M ? dc.E(new fC(eC.M, Ic.b, color, lc_0.C, df_1.b, 12), 1.0f) : dc.E(new fC(eC.D, Ic.b, color, lc_0.C, df_1.b, 12), 1.0f);
        } else if (a2.c == xa_1.C) {
            bufferedImage = a2.C == wB.M ? dc.E(new fC(eC.b, Ic.b, color, lc_0.C, df_1.b, 12), 1.0f) : dc.E(new fC(eC.C, Ic.b, color, lc_0.C, df_1.b, 12), 1.0f);
        } else {
            bufferedImage = new BufferedImage(4, n3, 2);
            object = bufferedImage.createGraphics();
            ((Graphics)object).setColor(color);
            Graphics2D graphics2D4 = object;
            graphics2D4.fillRect(0, 0, bufferedImage.getWidth() - 1, bufferedImage.getHeight() - 1);
            graphics2D4.dispose();
        }
        object = new BufferedImage(n2 + bufferedImage.getWidth(), n3, 2);
        Graphics2D graphics2D5 = ((BufferedImage)object).createGraphics();
        graphics2D5.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D6 = graphics2D5;
        Graphics2D graphics2D7 = graphics2D5;
        graphics2D7.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D7.setColor(Colors.TRANSPARENT);
        graphics2D6.fillRect(0, 0, ((BufferedImage)object).getWidth(), ((BufferedImage)object).getHeight());
        graphics2D6.drawImage((Image)bufferedImage, n2, Math.max(n3 - bufferedImage.getHeight(), 0) / 2, null);
        if (a2.M == cC.A) {
            if (a2.C == wB.M) {
                Graphics2D graphics2D8 = graphics2D5;
                graphics2D3 = graphics2D8;
                graphics2D8.drawImage(je_0.E(a3), 2, 7, 15, 15, null);
            } else {
                Graphics2D graphics2D9 = graphics2D5;
                graphics2D3 = graphics2D9;
                graphics2D9.drawImage(je_0.E(a3), 2, 2, 15, 15, null);
            }
        } else {
            graphics2D3 = graphics2D5;
            Graphics2D graphics2D10 = graphics2D5;
            graphics2D10.setColor(Color.BLACK);
            graphics2D10.fillRect(0, 0, n2, n3);
        }
        graphics2D3.setColor(color);
        if (a2.C == wB.M) {
            Graphics2D graphics2D11 = graphics2D5;
            graphics2D2 = graphics2D11;
            graphics2D11.fillRect(0, 0, n2, 5);
        } else {
            Graphics2D graphics2D12 = graphics2D5;
            graphics2D2 = graphics2D12;
            graphics2D12.fillRect(0, n3 - 5, n2, 5);
        }
        graphics2D2.setColor(Color.LIGHT_GRAY);
        if (a2.c == xa_1.A) {
            Graphics2D graphics2D13 = graphics2D5;
            graphics2D = graphics2D13;
            graphics2D13.drawRect(0, 0, ((BufferedImage)object).getWidth() - 1, ((BufferedImage)object).getHeight() - 1);
        } else {
            Graphics2D graphics2D14 = graphics2D5;
            graphics2D = graphics2D14;
            graphics2D14.drawRect(0, 0, n2 - 1, n3 - 1);
        }
        graphics2D.dispose();
        return object;
    }

    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ Pair<Integer, Integer> E(da_1 a2) {
        switch (a2.c) {
            case b: {
                return Pair.of((Object)20, (Object)15);
            }
            case C: {
                return Pair.of((Object)18, (Object)15);
            }
            case A: {
                return Pair.of((Object)0, (Object)(a2.b + 15));
            }
            case M: {
                return Pair.of((Object)0, (Object)30);
            }
        }
        return Pair.of((Object)0, (Object)0);
    }

    public hc_0() {
        hc_0 a2;
    }

    public static BufferedImage E(da_1 a2, cc_0 a3) {
        return hc_0.E(a2, a3.ttw_tradefinder_ub_E());
    }

    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ void E(Graphics2D a2, int a3, int a4, da_1 a5, Pair<Integer, Integer> a2222, int a6, Color a72) {
        a2.setColor(a72);
        switch (a5.c) {
            case b: {
                a4 -= ((Integer)a2222.getRight()).intValue();
                a6 = (Integer)a2222.getLeft();
                int a72 = (Integer)a2222.getRight() << 1;
                int a2222 = (Integer)a2222.getRight();
                int n2 = a6 / 4;
                if (a5.C == wB.c) {
                    a2.fillPolygon(new int[]{a3, a3 + n2, a3 + n2, a3 + a6 - n2, a3 + a6 - n2, a3 + a6, a3 + a6 / 2}, new int[]{a4 + a2222, a4 + a2222, a4 + a72, a4 + a72, a4 + a2222, a4 + a2222, a4}, 7);
                    return;
                }
                a2.fillPolygon(new int[]{a3, a3 + n2, a3 + n2, a3 + a6 - n2, a3 + a6 - n2, a3 + a6, a3 + a6 / 2}, new int[]{a4 + a72 - a2222, a4 + a72 - a2222, a4, a4, a4 + a72 - a2222, a4 + a72 - a2222, a4 + a72}, 7);
                return;
            }
            case C: {
                Pair<Integer, Integer> a2222;
                a6 = (Integer)a2222.getLeft();
                int a2222 = (Integer)a2222.getRight();
                if (a5.C == wB.c) {
                    a2.fillPolygon(new int[]{a3, a3 + a6, a3 + a6 / 2}, new int[]{(a4 -= a2222) + a2222, a4 + a2222, a4}, 3);
                    return;
                }
                a2.fillPolygon(new int[]{a3, a3 + a6, a3 + a6 / 2}, new int[]{a4, a4, a4 + a2222}, 3);
                return;
            }
            case A: 
            case M: {
                if (a5.C == wB.M) {
                    int n3 = a4;
                    a2.fillRect(a3 - 3, n3, 3, a6 - n3);
                    return;
                }
                a2.fillRect(a3 - 3, 0, 3, a4);
                return;
            }
        }
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 4 << 3 ^ 1;
        int cfr_ignored_0 = (3 ^ 5) << 4 ^ 2 << 1;
        int n5 = n3;
        int n6 = 4 << 4 ^ 2 << 1;
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }

    /*
     * Enabled aggressive block sorting
     */
    public static int E(xa_1 a2, int a3) {
        switch (a2) {
            case b: {
                return -a3 + 11;
            }
            case C: {
                return -a3 + 11;
            }
            case A: 
            case M: {
                return -a3 + 2;
            }
        }
        return -a3;
    }

    public static BufferedImage E(da_1 a2, ub a3) {
        Graphics2D graphics2D;
        ub ub2 = a3;
        da_1 da_12 = a2;
        a3.E(he_1.j(a2.A, da_12.D), a2.D);
        ub2.E((float)Math.min(Math.max(da_12.H, 8), 20) / 10.0f);
        Pair<Integer, Integer> pair = ub2.E(a2);
        Pair<Integer, Integer> pair2 = hc_0.E(a2);
        BufferedImage bufferedImage = new BufferedImage((Integer)pair.getLeft() + (Integer)pair2.getLeft(), (Integer)pair.getRight() + (Integer)pair2.getRight(), 2);
        Graphics2D graphics2D2 = bufferedImage.createGraphics();
        graphics2D2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Graphics2D graphics2D3 = graphics2D2;
        graphics2D2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics2D3.setColor(Colors.TRANSPARENT);
        graphics2D3.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
        graphics2D3.setColor(he_1.E(he_1.D, a2.D));
        switch (a2.C) {
            case M: {
                ub ub3;
                while (false) {
                }
                if (a2.M != cC.A) {
                    graphics2D2.fillRect(0, 0, (Integer)pair.getLeft(), (Integer)pair.getRight());
                    ub3 = a3;
                } else {
                    graphics2D2.fillRoundRect(0, 0, (Integer)pair.getLeft(), (Integer)pair.getRight() + 5, 6, 6);
                    ub3 = a3;
                }
                ub3.E(graphics2D2, 0, 0, pair, a2);
                hc_0.E(graphics2D2, (Integer)pair.getLeft(), (Integer)pair.getRight(), a2, pair2, bufferedImage.getHeight(), a3.java_awt_Color_E());
                Graphics2D graphics2D4 = graphics2D2;
                graphics2D4.setColor(a3.java_awt_Color_E());
                graphics2D4.fillRect(0, (Integer)pair.getRight(), (Integer)pair.getLeft(), 5);
                graphics2D = graphics2D2;
                break;
            }
            case c: {
                ub ub4;
                if (a2.M != cC.A) {
                    graphics2D2.fillRect(0, (Integer)pair2.getRight(), (Integer)pair.getLeft(), (Integer)pair.getRight());
                    ub4 = a3;
                } else {
                    graphics2D2.fillRoundRect(0, (Integer)pair2.getRight() - 5, (Integer)pair.getLeft(), (Integer)pair.getRight() + 5, 6, 6);
                    ub4 = a3;
                }
                ub4.E(graphics2D2, 0, (Integer)pair2.getRight(), pair, a2);
                hc_0.E(graphics2D2, (Integer)pair.getLeft(), (Integer)pair2.getRight(), a2, pair2, bufferedImage.getHeight(), a3.java_awt_Color_E());
                Graphics2D graphics2D5 = graphics2D2;
                graphics2D5.setColor(a3.java_awt_Color_E());
                graphics2D5.fillRect(0, (Integer)pair2.getRight() - 5, (Integer)pair.getLeft(), 5);
            }
            default: {
                graphics2D = graphics2D2;
            }
        }
        graphics2D.dispose();
        return bufferedImage;
    }

    /*
     * Enabled aggressive block sorting
     */
    public static int E(da_1 a2, int a3) {
        switch (a2.c) {
            case b: 
            case C: {
                switch (a2.C) {
                    case M: {
                        return a2.b;
                    }
                    case c: {
                        return -a2.b - a3;
                    }
                }
            }
            case M: {
                switch (a2.C) {
                    case M: {
                        return a2.b - 15;
                    }
                    case c: {
                        return -(a2.b - 15) - a3;
                    }
                }
            }
            case A: {
                switch (a2.C) {
                    case M: {
                        return 0;
                    }
                    case c: {
                        return -a3;
                    }
                }
                return 0;
            }
        }
        return 0;
    }
}

