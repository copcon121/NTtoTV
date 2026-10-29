/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import ttw.tradefinder.te_0;
import ttw.tradefinder.ud_0;
import ttw.tradefinder.wd_2;

/*
 * Renamed from ttw.tradefinder.Ie
 */
public class ie_1 {
    private static final DateFormat b;
    private static final DateTimeFormatter c;

    public /* synthetic */ ie_1() {
        ie_1 a2;
    }

    public static /* synthetic */ String E(long a2) {
        if (a2 == 0L) {
            return "00000000 00:00:00.000";
        }
        return c.format(Instant.ofEpochMilli(a2 / 1000000L));
    }

    static {
        c = DateTimeFormatter.ofPattern("yyyyMMdd HH:mm:ss.SSS").withZone(ZoneId.systemDefault());
        b = new SimpleDateFormat("yyyyMMdd_HHmmss");
    }

    public static /* synthetic */ ud_0 E(long a22) {
        if (a22 == 0L) {
            return ud_0.E();
        }
        ZonedDateTime a22 = Instant.ofEpochMilli(a22 / 1000000L).atZone(ZoneId.systemDefault());
        return new ud_0(a22.getHour(), a22.getMinute());
    }

    public static /* synthetic */ String E(Date a2) {
        return b.format(a2);
    }
}

