/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ra_1;
import ttw.tradefinder.te_0;

public class Df {
    public static String M = "First DOM level for starting the analysis of Order Book Imbalances.";
    public static String[] b;
    public static String[] c;

    public Df() {
        Df a2;
    }

    static {
        c = new String[]{"Last DOM level of Order Book Imbalance calculation.", "Thin instruments require higher DOM values for calculation."};
        b = new String[]{"Imbalance Trigger is the value in percent which points to the side (Bid or Ask) of higher order book imbalance.", "For example: if 20 is displayed on chart then there is a 20% higher imbalance on the side where the indicator points to.", "Price always seeks liquidity and imbalances to transact."};
    }
}

