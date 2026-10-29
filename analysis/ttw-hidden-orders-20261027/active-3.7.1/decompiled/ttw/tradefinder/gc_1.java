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
import java.awt.image.BufferedImage;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.Ad;
import ttw.tradefinder.hd;
import ttw.tradefinder.ib_0;
import ttw.tradefinder.za_1;
import velox.gui.colors.Colors;

/*
 * Renamed from ttw.tradefinder.Gc
 */
public class gc_1 {
    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 3 ^ 2;
        int cfr_ignored_0 = 4 << 4 ^ (3 << 2 ^ 3);
        int n5 = n3;
        int n6 = (3 ^ 5) << 4 ^ 1 << 1;
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

    public static BufferedImage E(ib_0 a222, int a32) {
        ib_0 a222;
        Graphics graphics;
        Object object;
        ib_0 ib_02 = a222;
        Pair<Integer, Integer> pair = gc_1.E(ib_02.A, ib_02.M);
        int n2 = (Integer)pair.getLeft();
        int n3 = (Integer)pair.getRight();
        if (a222.A == hd.b) {
            if (a222.M != Ad.H) {
                n2 = (int)((double)n2 * (1.0 + (double)a32 / 10.0));
            }
            n3 = (int)((double)n3 * (1.0 + (double)a32 / 10.0));
        }
        ib_0 ib_03 = a222;
        Color color = ib_03.C;
        if (ib_03.c == za_1.M) {
            float[] fArray = Color.RGBtoHSB(color.getRed(), color.getGreen(), color.getBlue(), null);
            object = fArray;
            fArray[1] = Math.min(1.0f, 0.2f + 0.08f * (float)Math.max(0, Math.min(10, a32)));
            color = Color.getHSBColor((float)object[0], (float)object[1], (float)object[2]);
        }
        object = new BufferedImage(n2, n3, 2);
        Graphics a32 = ((BufferedImage)object).getGraphics();
        if (a222.M == Ad.c) {
            int a222 = n3 / 3;
            int n4 = n2 / 4;
            Graphics graphics2 = a32;
            graphics = graphics2;
            Graphics graphics3 = a32;
            graphics3.setColor(Colors.TRANSPARENT);
            graphics3.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics2.setColor(color);
            graphics2.fillPolygon(new int[]{0, n4, n4, n2 - n4, n2 - n4, n2 - 1, n2 / 2}, new int[]{a222, a222, n3 - 1, n3 - 1, a222, a222, 0}, 7);
        } else if (a222.M == Ad.C) {
            int a222 = n3 / 3;
            int n5 = n2 / 4;
            Graphics graphics4 = a32;
            graphics = graphics4;
            Graphics graphics5 = a32;
            graphics5.setColor(Colors.TRANSPARENT);
            graphics5.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics4.setColor(color);
            graphics4.fillPolygon(new int[]{0, n5, n5, n2 - n5, n2 - n5, n2 - 1, n2 / 2}, new int[]{n3 - a222, n3 - a222, 0, 0, n3 - a222, n3 - a222, n3 - 1}, 7);
        } else if (a222.M == Ad.b) {
            Graphics graphics6 = a32;
            graphics = graphics6;
            Graphics graphics7 = a32;
            graphics7.setColor(Colors.TRANSPARENT);
            graphics7.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics6.setColor(color);
            graphics6.fillOval(0, 0, n2 - 1, n3 - 1);
        } else if (a222.M == Ad.D || a222.M == Ad.H) {
            graphics = a32;
            Graphics graphics8 = a32;
            graphics8.setColor(color);
            graphics8.fillRect(0, 0, n2 - 1, n3 - 1);
        } else if (a222.M == Ad.h) {
            Graphics graphics9 = a32;
            graphics = graphics9;
            Graphics graphics10 = a32;
            graphics10.setColor(Colors.TRANSPARENT);
            graphics10.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics9.setColor(color);
            graphics9.fillPolygon(new int[]{0, n2 - 1, n2 / 2}, new int[]{n3 - 1, n3 - 1, 0}, 3);
        } else if (a222.M == Ad.A) {
            Graphics graphics11 = a32;
            graphics = graphics11;
            Graphics graphics12 = a32;
            graphics12.setColor(Colors.TRANSPARENT);
            graphics12.fillRect(0, 0, n2 - 1, n3 - 1);
            graphics11.setColor(color);
            graphics11.fillPolygon(new int[]{0, n2 - 1, n2 / 2}, new int[]{0, 0, n3 - 1}, 3);
        } else {
            graphics = a32;
            Graphics graphics13 = a32;
            graphics13.setColor(Colors.TRANSPARENT);
            graphics13.fillRect(0, 0, 1, 1);
        }
        graphics.dispose();
        return object;
    }

    public static int E(int a2, int a3) {
        return Math.min(260, Math.max(40, a2)) - a3 / 2;
    }

    public gc_1() {
        gc_1 a2;
    }

    /*
     * Enabled aggressive block sorting
     */
    private static /* synthetic */ Pair<Integer, Integer> E(hd a2, Ad a3) {
        switch (a3) {
            case c: 
            case C: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)14, (Object)17);
                    }
                    case c: {
                        return Pair.of((Object)11, (Object)13);
                    }
                    case M: {
                        return Pair.of((Object)17, (Object)20);
                    }
                    case A: {
                        return Pair.of((Object)23, (Object)28);
                    }
                }
                return Pair.of((Object)17, (Object)20);
            }
            case b: 
            case D: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)13, (Object)13);
                    }
                    case c: {
                        return Pair.of((Object)10, (Object)10);
                    }
                    case M: {
                        return Pair.of((Object)15, (Object)15);
                    }
                    case A: {
                        return Pair.of((Object)22, (Object)22);
                    }
                }
                return Pair.of((Object)15, (Object)15);
            }
            case h: 
            case A: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)13, (Object)11);
                    }
                    case c: {
                        return Pair.of((Object)10, (Object)9);
                    }
                    case M: {
                        return Pair.of((Object)15, (Object)13);
                    }
                    case A: {
                        return Pair.of((Object)22, (Object)19);
                    }
                }
                return Pair.of((Object)15, (Object)13);
            }
            case H: {
                switch (a2) {
                    case b: {
                        return Pair.of((Object)4, (Object)13);
                    }
                    case c: {
                        return Pair.of((Object)4, (Object)10);
                    }
                    case M: {
                        return Pair.of((Object)4, (Object)15);
                    }
                    case A: {
                        return Pair.of((Object)4, (Object)22);
                    }
                }
                return Pair.of((Object)4, (Object)15);
            }
        }
        return Pair.of((Object)12, (Object)12);
    }
}

