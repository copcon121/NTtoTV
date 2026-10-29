/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.KB;
import ttw.tradefinder.cd;
import ttw.tradefinder.kd_1;

/*
 * Renamed from ttw.tradefinder.ZC
 */
public class zc_2 {
    public static /* synthetic */ String a(cd a2) {
        a2.ordinal();
        return "https://tradefinder.info";
    }

    public static /* synthetic */ cd E(String a2) {
        if (a2.equals("5732")) {
            return cd.c;
        }
        if (a2.equals("2343")) {
            return cd.h;
        }
        if (a2.equals("2344")) {
            return cd.A;
        }
        if (a2.equals("3350")) {
            return cd.C;
        }
        if (a2.equals("2561")) {
            return cd.H;
        }
        if (a2.equals("8799")) {
            return cd.D;
        }
        return cd.b;
    }

    /*
     * Enabled aggressive block sorting
     */
    public static /* synthetic */ String j(cd a2) {
        switch (a2) {
            case c: {
                return "5732";
            }
            case h: {
                return "2343";
            }
            case A: {
                return "2344";
            }
            case C: {
                return "3350";
            }
            case H: {
                return "2561";
            }
            case D: {
                return "8799";
            }
        }
        return "";
    }

    /*
     * Enabled aggressive block sorting
     */
    public static /* synthetic */ String E(cd a2) {
        switch (a2) {
            case c: {
                return "TTW-TradeFinder Brazil";
            }
            case h: {
                return "TTW-TradeFinder Basic";
            }
            case A: {
                return "TTW-TradeFinder Pro";
            }
            case C: {
                return "TTW-TradeFinder Ultra";
            }
            case H: {
                return "TTW-TradeFinder Dev";
            }
            case D: {
                return "TTW-TradeFinder Crypto";
            }
        }
        return "invalid license id";
    }

    public /* synthetic */ zc_2() {
        zc_2 a2;
    }
}

