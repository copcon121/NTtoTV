/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.a;

import java.awt.Color;
import java.awt.image.LookupTable;
import java.util.Arrays;

public class a
extends LookupTable {
    private final int[] a;
    private final int[] b;

    public a(Color color, Color color2) {
        super(0, 4);
        this.a = new int[]{color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha()};
        this.b = new int[]{color2.getRed(), color2.getGreen(), color2.getBlue(), color2.getAlpha()};
    }

    @Override
    public int[] lookupPixel(int[] nArray, int[] nArray2) {
        if (nArray2 == null) {
            nArray2 = new int[nArray.length];
        }
        int[] nArray3 = Arrays.equals(nArray, this.a) ? this.b : nArray;
        System.arraycopy(nArray3, 0, nArray2, 0, nArray3.length);
        return nArray2;
    }
}

