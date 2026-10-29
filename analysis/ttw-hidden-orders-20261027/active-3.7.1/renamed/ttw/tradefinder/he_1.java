/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.Ff;
import ttw.tradefinder.lD;
import ttw.tradefinder.la_1;

/*
 * Renamed from ttw.tradefinder.HE
 */
public class he_1 {
    public static Color K;
    public static Color E;
    public static Color j;
    public static Color a;
    public static Color h;
    public static Color H;
    public static Color D;
    public static Color A;
    public static Color C;
    public static Color M;
    public static Color b;
    public static Color c;

    public static /* synthetic */ Color j(Color a2, int a3) {
        return new Color(a2.getRed(), a2.getGreen(), a2.getBlue(), a3);
    }

    static {
        H = Color.decode(Ff.E("\u00012d2d2d"));
        D = Color.decode(lD.E("Q=@=B=C"));
        C = Color.decode(Ff.E("\u00016d6d6d"));
        h = Color.decode(lD.E("QK7K7K7"));
        j = Color.decode(Ff.E("\u0001@\u00115cL`"));
        b = Color.decode(lD.E("Q7EKDM1"));
        c = Color.decode(Ff.E("\u00012\u001b@\u0013@\u0016"));
        M = Color.decode(lD.E("QH6OGOJ"));
        A = Color.decode(Ff.E("\u0001Af5\u00111c"));
        E = Color.decode(lD.E("Q9E66OK"));
        a = Color.decode(Ff.E("\u00012dMdEa"));
        K = Color.decode(lD.E("QH0JJ94"));
    }

    /*
     * Enabled aggressive block sorting
     */
    public static /* synthetic */ Color j(la_1 a2, int a3) {
        switch (a2) {
            case c: {
                return he_1.E(j, a3);
            }
            case D: {
                return he_1.E(b, a3);
            }
            case b: {
                return he_1.E(c, a3);
            }
            case h: {
                return he_1.E(M, a3);
            }
            case A: {
                return he_1.E(E, a3);
            }
            case C: {
                return he_1.E(a, a3);
            }
            case H: {
                return he_1.E(K, a3);
            }
        }
        return he_1.E(D, a3);
    }

    public /* synthetic */ he_1() {
        he_1 a2;
    }

    public static /* synthetic */ Color E(Color a2, int a3) {
        return new Color(a2.getRed(), a2.getGreen(), a2.getBlue(), a3);
    }

    public static /* synthetic */ Color E(Color a2, Color a3) {
        return new Color(a2.getRed(), a2.getGreen(), a2.getBlue(), a3.getAlpha());
    }

    public static /* synthetic */ Color E(la_1 a2, int a3) {
        switch (a2) {
            case c: 
            case b: 
            case A: 
            case C: {
                while (false) {
                }
                return he_1.E(H, a3);
            }
            case D: 
            case h: 
            case H: {
                return he_1.E(D, a3);
            }
        }
        return he_1.E(H, a3);
    }
}

