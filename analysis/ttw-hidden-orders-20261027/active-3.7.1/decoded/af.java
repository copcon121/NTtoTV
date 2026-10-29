/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ed_0;
import ttw.tradefinder.kd_1;

public class af {
    public static String B;
    public static String[] K;
    public static String E;
    public static String[] j;
    public static String a;
    public static String[] h;
    public static String[] H;
    public static String[] D;
    public static String[] A;
    public static String C;
    public static String[] M;
    public static String b;
    public static String c;

    public af() {
        af a2;
    }

    static {
        h = new String[]{"Relative liquidity which is added fast and hidden to an already existing limit liquidity in the DOM on limit (Bid or Ask) side.", "For example: Liquidity at a price on limit (Bid/Ask) is already 115 lots.", "When additional 300 lots are added fast and (silently) to this price, +300 will be indicated immediately on Bookmap chart.", "Indicates hidden liquidity activities (resistance or support) in the DOM at a price.", "Values are defined with + (adding) and - (cancelling) of liquidity."};
        E = "Defines the first DOM level where TTW-TradeFinder starts to analyze relative liquidity changes.";
        a = "Defines the up to DOM level where TTW-TradeFinder end its analyses of relative liquidity changes.";
        D = new String[]{"Absolute liquidity changes designates the total or absolute changes of limit liquidity in the DOM on limit (Bid or Ask) side.", "For example: Liquidity at a price on limit (Bid/Ask) is already 115 lots.", "When additional 385 lots are added fast and (silently) to that price, +500 will be indicated immediately on Bookmap chart.", "Indicates hidden liquidity activities (resistance or support) in the DOM at a price.", "Values are defined with + (adding) and - (cancelling) of liquidity."};
        c = "Defines the first DOM level where TTW-TradeFinder starts to analyze absolute liquidty changes.";
        B = "Defines the up to DOM level where TTW-TradeFinder ends its analyses of absolute liquidty changes.";
        M = new String[]{"By activating, the Volume and Liquidity Live View will open as a separate window.", "Live View can be opened for every active chart. No need to open a chart externally.", "Live View displays live market volume and limit liquidity.", "Invaluable help to understand instruments liquidity and the correlation between market volume and resting liquidity in the DOM."};
        b = "First DOM level of average liquidity. First DOM level in the Order Book is always the BBO (Best-Bid-Offer) price level.";
        H = new String[]{"Last DOM level of average liquidity calculation.", "Liquidity of these levels will be averaged to indicate relevant information about a instruments condition based on its liquidity."};
        K = new String[]{"Time in seconds market volume will be recalculated and displayed.", "Market volume together with liquidity gives deep insights into actual market conditions."};
        A = new String[]{"Time in seconds market volume will be evaluated for price dynamics.", "Market volume together with liquidity gives deep insights into actual market conditions."};
        C = "First DOM level for price dynamics calculation.\nFirst DOM level in the Order Book is always the BBO (Best-Bid-Offer) price level.";
        j = new String[]{"Last DOM level for price dynamics calculation.", "Liquidity of these levels will be averaged to indicate relevant information about a instruments condition based on its liquidity."};
    }
}

