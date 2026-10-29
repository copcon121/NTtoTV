/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.bC;
import ttw.tradefinder.bb_2;

/*
 * Renamed from ttw.tradefinder.Ae
 */
public class ae_0 {
    public static String h;
    public static String H;
    public static String[] D;
    public static String A;
    public static String C;
    public static String[] M;
    public static String[] b;
    public static String[] c;

    public ae_0() {
        ae_0 a2;
    }

    static {
        C = "Minimum volume which must be traded and finished by a hidden order to display a signal on Chart.";
        h = "Minimum percentual volume of trigger size which must be traded by a hidden order to display a trace on Chart";
        H = "Avoiding the display of every single low-volume size of a synthetic hidden order.";
        A = "Select between Native(-n), Synthetic(-s), Combined hidden orders.";
        b = new String[]{"When Enabled a DOM of all the hidden orders within the chart-range is placed on the right side of the main chart."};
        M = new String[]{"Click to activate and open a separate hidden order navigator window.", "Hidden order tracker allows to toggle through every displayed hidden orders on chart.", "Gives deep insights into hidden orders."};
        c = new String[]{"Dynamic Hidden Order Plot display plots of every found, analyzed and finished hidden order", "based on the selected method: Native, Synthetic, Combined,", "in the lower part of the historical Bookmap chart."};
        D = new String[]{"Please select one of the following view options:", " - Compact, Shows actual traded volume on the hidden order", " - Advanced, Additionally shows the open (not traded) volume of the actual tranch", " - Professional, Additionally shows the duration of the hidden order since it was placed in book"};
    }
}

