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
    public static final String b = ac_2.E("|\u0016`\u0012gX;M`\u0016c\u0016f\u0003p\u0007fLw\ryM`\u0016cO`\u0010u\u0006q\u0004}\fp\u0007fM");
    public static final String c = ub.E("\f\u000f\u0010\u000b\u0017AKT\u0010\u000f\u0013\u000f\u0016\u001a\u0000\u001e\u0016U\u0007\u0014\tT\t\u001e\t\u0019\u0001\t\u0017T");

    public static vE E(String a2, String a3) {
        if (a3 == null || a3.isEmpty()) {
            return qE.E((String)a2);
        }
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split(ac_2.E("O>f]H\fII"))));
        return new vE(qE.E((List<String>)a2), a3);
    }

    public static vE E(String a2, String[] a3) {
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split(ac_2.E("O>f]H\fII"))));
        if (a3.length > 0) {
            a2.add("");
        }
        a2.addAll(Arrays.asList(a3));
        return new vE(qE.E((List<String>)a2), ub.E("\f\u000f\u0010\u000b\u0017AKT\u0010\u000f\u0013\u000f\u0016\u001a\u0000\u001e\u0016U\u0007\u0014\tT\u0010\u000f\u0013V\u0010\t\u0005\u001f\u0001\u001d\r\u0015\u0000\u001e\u0016T"));
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
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split(ub.E("?'\u0016D8\u00159P"))));
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
        a2.add(ac_2.E("!x\u000bw\t4\u0004{\u00104\u000f{\u0010qB}\fr\rf\u000fu\u0016}\rzL"));
        return "<html>" + String.join((CharSequence)ub.E("DG\u0006\tZ["), a2) + "</html>";
    }

    public static String[] E(int a2, int a3, int a4) {
        return new String[]{String.format(ac_2.E("B\u0003x\u0017qBF\u0003z\u0005qX4GgB9B1\u0011"), Integer.toString(a2), Integer.toString(a3)), String.format(ub.E("2\n\u0018\u0016\u001e\t\u001e\n\u000f^[A\b"), Integer.toString(a4))};
    }

    public static String[] E(double a2, double a3, double a4, String a5) {
        a5 = new DecimalFormat((String)a5);
        return new String[]{String.format(ac_2.E("B\u0003x\u0017qBF\u0003z\u0005qX4GgB9B1\u0011"), ((NumberFormat)a5).format(a2), ((NumberFormat)a5).format(a3)), String.format(ub.E("2\n\u0018\u0016\u001e\t\u001e\n\u000f^[A\b"), ((NumberFormat)a5).format(a4))};
    }

    public static vE E(String a2, boolean a3) {
        if (a2 == null || ((String)a2).isEmpty()) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(((String)a2).split(ac_2.E("O>f]H\fII"))));
        return new vE(qE.E((List<String>)a2), ub.E("\f\u000f\u0010\u000b\u0017AKT\u0010\u000f\u0013\u000f\u0016\u001a\u0000\u001e\u0016U\u0007\u0014\tT\u0010\u000f\u0013V\u0010\t\u0005\u001f\u0001\u001d\r\u0015\u0000\u001e\u0016T"), a3);
    }

    public static vE E(String[] a2, boolean a3) {
        if (((String[])a2).length == 0) {
            return new vE();
        }
        a2 = new ArrayList<String>(Arrays.asList(a2));
        return new vE(qE.E((List<String>)a2), ac_2.E("|\u0016`\u0012gX;M`\u0016c\u0016f\u0003p\u0007fLw\ryM`\u0016cO`\u0010u\u0006q\u0004}\fp\u0007fM"), a3);
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
        return new vE(qE.E((List<String>)a2), ub.E("\f\u000f\u0010\u000b\u0017AKT\u0010\u000f\u0013\u000f\u0016\u001a\u0000\u001e\u0016U\u0007\u0014\tT\u0010\u000f\u0013V\u0010\t\u0005\u001f\u0001\u001d\r\u0015\u0000\u001e\u0016T"));
    }
}

