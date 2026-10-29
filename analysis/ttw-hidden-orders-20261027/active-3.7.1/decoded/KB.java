/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.font.FontRenderContext;
import java.awt.font.GlyphVector;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.lang3.tuple.Triple;

public abstract class KB {
    public /* synthetic */ List<Triple<String, Color, Integer>> j(Font a2, List<Pair<String, Color>> a3) {
        Object object = new BufferedImage(1, 1, 2);
        object = ((BufferedImage)object).createGraphics();
        ((Graphics2D)object).setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Object object2 = object;
        ((Graphics)object2).setFont((Font)a2);
        a2 = ((Graphics)object2).getFontMetrics();
        ArrayList<Triple<String, Color, Integer>> arrayList = new ArrayList<Triple<String, Color, Integer>>();
        a3 = a3.iterator();
        block0: while (true) {
            Object object3 = a3;
            while (object3.hasNext()) {
                Pair pair = (Pair)a3.next();
                if (pair.getLeft() == null || ((String)pair.getLeft()).isEmpty()) continue block0;
                arrayList.add((Triple<String, Color, Integer>)Triple.of((Object)((String)pair.getLeft()), (Object)((Color)pair.getRight()), (Object)((FontMetrics)a2).stringWidth((String)pair.getLeft())));
                object3 = a3;
            }
            break;
        }
        ((Graphics)object).dispose();
        return arrayList;
    }

    public /* synthetic */ Triple<Integer, Integer, Integer> E(Font a2, String a3) {
        if (a3 == null || ((String)a3).isEmpty()) {
            return Triple.of((Object)0, (Object)0, (Object)0);
        }
        Object object = new BufferedImage(1, 1, 2);
        object = ((BufferedImage)object).createGraphics();
        ((Graphics2D)object).setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Object object2 = object;
        ((Graphics)object2).setFont((Font)a2);
        a2 = ((Graphics2D)object2).getFontRenderContext();
        a3 = ((Graphics)object2).getFont().createGlyphVector((FontRenderContext)a2, (String)a3);
        a2 = ((GlyphVector)a3).getPixelBounds((FontRenderContext)a2, 0.0f, 0.0f);
        a2 = Triple.of((Object)((int)((Rectangle)a2).getWidth()), (Object)((int)((Rectangle)a2).getHeight()), (Object)(-((Rectangle)a2).y));
        ((Graphics)object2).dispose();
        return a2;
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 1 << 1;
        int cfr_ignored_0 = (3 ^ 5) << 3;
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

    public /* synthetic */ List<Triple<String, Color, Integer>> E(Font a2, List<Triple<String, Color, Integer>> a3) {
        Object object = new BufferedImage(1, 1, 2);
        object = ((BufferedImage)object).createGraphics();
        ((Graphics2D)object).setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Object object2 = object;
        ((Graphics)object2).setFont((Font)a2);
        a2 = ((Graphics)object2).getFontMetrics();
        ArrayList<Triple<String, Color, Integer>> arrayList = new ArrayList<Triple<String, Color, Integer>>();
        Object object3 = a3 = a3.iterator();
        while (object3.hasNext()) {
            Triple triple = (Triple)a3.next();
            arrayList.add((Triple<String, Color, Integer>)Triple.of((Object)((String)triple.getLeft()), (Object)((Color)triple.getMiddle()), (Object)((FontMetrics)a2).stringWidth((String)triple.getLeft())));
            object3 = a3;
        }
        ((Graphics)object).dispose();
        return arrayList;
    }

    public KB() {
        KB a2;
    }
}

