/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.ff_0;
import ttw.tradefinder.wd_1;

/*
 * Renamed from ttw.tradefinder.Cf
 */
public class cf_0 {
    public static String d;
    public static String[] i;
    public static String e;
    public static String k;
    public static String[] B;
    public static String[] K;
    public static String E;
    public static String j;
    public static String a;
    public static String h;
    public static String[] H;
    public static String D;
    public static String[] A;
    public static String C;
    public static String[] M;
    public static String b;
    public static String[] c;

    static {
        M = new String[]{"Volume which must be triggered to get a signal displayed on chart. Volume depends on instruments liquidity (Stock, Future).", "Formula to determine approximative volume sizes for a Volume Spike is Volume = Instruments Avrg. Liquidity * Price Range.", "Rounding the number helps finding best possible signals.", "Configuration may vary based on daily volatility."};
        K = new String[]{"Time which determines the duration of a Volume Spike.", "Within this time the Volume Spike must meet all conditions to appear on chart."};
        E = "Price range in ticks / cents which at least must be traded through.";
        i = new String[]{"Ratio between traded market volume which sells into Bid (hitBID) and the market volume which buys from Ask (liftAsk).", "The higher the ratio the most likely a reversal is.", "Volume Spike as well Sweeps leaves a vacuum behind, which is going to be filled."};
        C = "Market volume which must be triggered by a single Order-ID to qualify as a Sweep signal.";
        h = "Price range in ticks/cents which at least must be swept through.";
        j = "Market volume which must be reached to trigger a signal.";
        e = "Number of ticks/cents the price has to move to trigger a signal.";
        d = "Market Volume which must be transacted and completely be absorbed by resting limit orders. ";
        k = "Time of the absorption. Absorption needs time to complete all traded orders on market and limit side.";
        A = new String[]{"Volume which must be triggered to get a signal displayed on chart.", "The signal gets displayed every time when the trigger volume is reached after a 10% return under trigger volume."};
        H = new String[]{"Hide consecutive signals if they occurred within less than 'Pullback Duration' minutes", "and if price moved less than 'Pullback Price Change' ticks in the right direction."};
        c = new String[]{"Hide consecutive signals if they occurred within less than 'Pullback Duration' minutes", "and if price moved less than 'Pullback Price Change' ticks in the right direction."};
        B = new String[]{"Stop Volume which must be triggered to get a signal displayed on chart.", "The signal gets displayed every time when the trigger volume is reached after a 10% return under trigger volume."};
        a = "Exponential halftime for Stop Volume Line";
        b = "Duration within all market orders are summed up.";
        D = "Duration within all price changes are summed up.";
    }

    public cf_0() {
        cf_0 a2;
    }
}

