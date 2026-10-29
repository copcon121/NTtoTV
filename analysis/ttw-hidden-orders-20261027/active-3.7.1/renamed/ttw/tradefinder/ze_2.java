/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.data.InstrumentInfo
 */
package ttw.tradefinder;

import java.text.DecimalFormat;
import ttw.tradefinder.bC;
import ttw.tradefinder.dd_1;
import ttw.tradefinder.xf_0;
import velox.api.layer1.data.InstrumentInfo;

/*
 * Renamed from ttw.tradefinder.Ze
 */
public class ze_2 {
    private DecimalFormat E;
    public dd_1 j;
    public int a;
    public int h;
    private DecimalFormat H;
    public final String D;
    public double A;
    public boolean C;
    public final String M;
    public double b;
    public double c;

    private static /* synthetic */ String j(String a2) {
        if ((a2 = ze_2.java_lang_String_E(a2)) == null || a2.isEmpty()) {
            return xf_0.E("iKwKsRr");
        }
        if (a2.contains(bC.E("$"))) {
            String[] stringArray = a2.split(xf_0.E("y&"));
            if (stringArray.length == 0) {
                return a2;
            }
            return stringArray[0];
        }
        String[] stringArray = a2.split(bC.E("^0"));
        if (stringArray.length == 0) {
            return a2;
        }
        return stringArray[0];
    }

    private static /* synthetic */ String E(int a2, int a3, char a4) {
        if (a2 == 0 && a3 == 0) {
            return xf_0.E("?");
        }
        Object object = bC.E("!0");
        int n2 = a2;
        while (true) {
            --a2;
            if (n2 <= 0) break;
            object = (String)object + a4;
            n2 = a2;
        }
        int n3 = a3;
        while (true) {
            --a3;
            if (n3 <= 0) break;
            object = (String)object + "#";
            n3 = a3;
        }
        return object;
    }

    private static /* synthetic */ int j(double a2) {
        int n2 = 0;
        double d2 = a2;
        while (Double.compare(d2, 1.0) > 0) {
            ++n2;
            d2 = a2 / 10.0;
        }
        return n2;
    }

    private static /* synthetic */ dd_1 ttw_tradefinder_dd_1_E(String a2) {
        if (a2 == null || a2.isEmpty()) {
            return ze_2.E(a2, false);
        }
        String[] stringArray = a2.split(bC.E("^"));
        if (stringArray.length < 2) {
            return ze_2.E(a2, false);
        }
        return ze_2.E(stringArray[1], false);
    }

    public String a(int a2) {
        ze_2 a3;
        return ze_2.E(a3.h, a2, '0');
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 3 ^ 5;
        int cfr_ignored_0 = 2 << 3 ^ 1;
        int n5 = n3;
        int n6 = (3 ^ 5) << 3 ^ 5;
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

    public static ze_2 ttw_tradefinder_ze_2_E(String a2) {
        String string = a2;
        return new ze_2(string, ze_2.j(string), ze_2.ttw_tradefinder_dd_1_E(a2), 1.0, 1.0, 1.0, false);
    }

    public double double_j(int a2) {
        ze_2 a3;
        return (double)a2 * a3.c;
    }

    public String java_lang_String_E(double a2) {
        ze_2 a3;
        return a3.H.format(a2);
    }

    private static /* synthetic */ dd_1 E(String a2, boolean a3) {
        if (a3) {
            return dd_1.A;
        }
        if (a2 == null || a2.isEmpty()) {
            return dd_1.c;
        }
        if ((a2 = a2.replace(xf_0.E("\\"), "").toLowerCase()).contains(bC.E("ffd{gz"))) {
            return dd_1.C;
        }
        if (a2.contains(xf_0.E("\u007f@xWs"))) {
            return dd_1.D;
        }
        return dd_1.c;
    }

    private static /* synthetic */ int int_E(double a2) {
        boolean bl = false;
        int n2 = 0;
        boolean bl2 = bl;
        while (!bl2 || Double.compare(a2, 1.0) >= 0) {
            if (Double.compare(a2, 1.0) >= 0) {
                bl = true;
            }
            ++n2;
            a2 = a2 % 1.0 * 10.0;
            bl2 = bl;
        }
        return n2 - 1;
    }

    public String java_lang_String_j(int a2) {
        ze_2 a3;
        return a3.E.format((double)a2 * a3.c);
    }

    public static ze_2 E(String a2, InstrumentInfo a3) {
        if (a3 == null) {
            return ze_2.ttw_tradefinder_ze_2_E(a2);
        }
        InstrumentInfo instrumentInfo = a3;
        return new ze_2(a2, instrumentInfo.symbol, ze_2.E(instrumentInfo.type, a3.isCrypto), a3.multiplier, a3.sizeMultiplier, a3.pips, a3.isFullDepth);
    }

    private /* synthetic */ ze_2(String a2, String a3, dd_1 a4, double a5, double a6, double a7, boolean a8) {
        ze_2 a9;
        a9.M = a2 == null || a2.isEmpty() ? xf_0.E("iKwKsRr") : a2;
        a9.D = a3 == null || a3.isEmpty() ? bC.E("klulqup") : a3;
        a9.j = a4;
        a9.E(a5, a6, a7, a8);
    }

    public String E() {
        ze_2 a2;
        return ze_2.E(a2.a, 0, '#');
    }

    private static /* synthetic */ String java_lang_String_E(String a2) {
        if (a2 == null || a2.isEmpty()) {
            return xf_0.E("iKwKsRr");
        }
        String[] stringArray = a2.split(bC.E("^"));
        if (stringArray.length == 0) {
            return a2;
        }
        return stringArray[0];
    }

    public String toString() {
        ze_2 a2;
        return String.format(xf_0.E("9V0\u00059V0\u00059V0\u0005lLlV&\u00059V0\u0005qPpQu\u001f<\u0000o\t<Vu_yHiIhL&\u00059V0\u0005x@\u007fFsPrQ&\u00059V0\u0005zPpIx@lQt\u001f<\u0000o"), a2.M, a2.D, a2.j.toString(), Double.toString(a2.c), Double.toString(a2.b), Double.toString(a2.A), Integer.toString(a2.h), Boolean.toString(a2.C));
    }

    public double double_E(int a2) {
        ze_2 a3;
        return (double)a2 / a3.A;
    }

    public String java_lang_String_E(int a2) {
        ze_2 a3;
        return a3.H.format((double)a2 / a3.A);
    }

    public void E(InstrumentInfo a2) {
        ze_2 a3;
        if (a2 == null) {
            return;
        }
        InstrumentInfo instrumentInfo = a2;
        a3.j = ze_2.E(a2.type, instrumentInfo.isCrypto);
        a3.E(instrumentInfo.multiplier, a2.sizeMultiplier, a2.pips, a2.isFullDepth);
    }

    private /* synthetic */ void E(double a2, double a3, double a4, boolean a5) {
        ze_2 a6;
        a6.c = Double.isNaN(a4) || Double.compare(a4, 0.0) <= 0 ? 1.0 : a4;
        a6.b = Double.isNaN(a2) || Double.compare(a2, 0.0) <= 0 ? 1.0 : a2;
        a6.A = Double.isNaN(a3) || Double.compare(a3, 0.0) <= 0 ? 1.0 : a3;
        ze_2 ze_22 = a6;
        ze_22.C = a5;
        ze_22.h = ze_2.j(ze_22.A);
        ze_22.a = ze_2.int_E(ze_22.c);
        ze_22.E = new DecimalFormat(a6.E());
        ze_22.H = new DecimalFormat(a6.a(0));
    }
}

