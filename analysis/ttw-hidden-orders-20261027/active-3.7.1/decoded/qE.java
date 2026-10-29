/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.ub;
import ttw.tradefinder.vE;

public class qE {
    public static final String b = "https://ttwtrader.com/ttw-tradefinder/";
    public static final String c = "https://ttwtrader.com/members/";

    public static vE E(String a2, String a3) {
        if (a3 == null || a3.isEmpty()) {
            return qE.E((String)a2);
        }
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split("[\\r?\\n]+")));
        return new vE(qE.E((List<String>)a2), a3);
    }

    public static vE E(String a2, String[] a3) {
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split("[\\r?\\n]+")));
        if (a3.length > 0) {
            a2.add("");
        }
        a2.addAll(Arrays.asList(a3));
        return new vE(qE.E((List<String>)a2), "https://ttwtrader.com/ttw-tradefinder/");
    }

    public static vE E(String a2) {
        return qE.E(a2, false);
    }

    public qE() {
        qE a2;
    }

    public static vE E(String a2, String[] a3, String a4) {
        if (a4 == null || a4.isEmpty()) {
            return qE.E((String)a2, a3);
        }
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split("[\\r?\\n]+")));
        if (a3.length > 0) {
            a2.add("");
        }
        a2.addAll(Arrays.asList(a3));
        return new vE(qE.E((List<String>)a2), a4);
    }

    public static vE E(String[] a2) {
        return qE.E(a2, false);
    }

    private static /* synthetic */ String E(List<String> a2) {
        if (a2.size() == 0) {
            return "";
        }
        a2.add("");
        a2.add("Click for more information.");
        return "<html>" + String.join((CharSequence)" <br> ", a2) + "</html>";
    }

    public static String[] E(int a2, int a3, int a4) {
        return new String[]{String.format("Value Range: %s - %s", Integer.toString(a2), Integer.toString(a3)), String.format("Increment: %s", Integer.toString(a4))};
    }

    public static String[] E(double a2, double a3, double a4, String a5) {
        a5 = new DecimalFormat((String)a5);
        return new String[]{String.format("Value Range: %s - %s", ((NumberFormat)a5).format(a2), ((NumberFormat)a5).format(a3)), String.format("Increment: %s", ((NumberFormat)a5).format(a4))};
    }

    public static vE E(String a2, boolean a3) {
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split("[\\r?\\n]+")));
        return new vE(qE.E((List<String>)a2), "https://ttwtrader.com/ttw-tradefinder/", a3);
    }

    public static vE E(String[] a2, boolean a3) {
        if (((String[])a2).length == 0) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(a2));
        return new vE(qE.E((List<String>)a2), "https://ttwtrader.com/ttw-tradefinder/", a3);
    }

    public static vE E(String[] a2, String[] a3, String a4) {
        if (a4 == null || a4.isEmpty()) {
            return qE.E((String[])a2, a3);
        }
        if (((String[])a2).length == 0) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(a2));
        if (a3.length > 0) {
            a2.add("");
        }
        a2.addAll(Arrays.asList(a3));
        return new vE(qE.E((List<String>)a2), a4);
    }

    public static vE E(String[] a2, String a3) {
        if (a3 == null || a3.isEmpty()) {
            return qE.E(a2);
        }
        if (((String[])a2).length == 0) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(a2));
        return new vE(qE.E((List<String>)a2), a3);
    }

    public static vE E(String[] a2, String[] a3) {
        if (((String[])a2).length == 0) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(a2));
        if (a3.length > 0) {
            a2.add("");
        }
        a2.addAll(Arrays.asList(a3));
        return new vE(qE.E((List<String>)a2), "https://ttwtrader.com/ttw-tradefinder/");
    }
}

