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

    public static /* synthetic */ String java_lang_String_E(long a2) {
        if (a2 == 0L) {
            return wd_2.E("\u0004A\u0004A\u0004A\u0004A\u0014A\u0004K\u0004A\u000eA\u0004_\u0004A\u0004");
        }
        return c.format(Instant.ofEpochMilli(a2 / 1000000L));
    }

    static {
        c = DateTimeFormatter.ofPattern(te_0.E("B1B1v\u0005_,\u001b\u0000srV%\u0001;Hfh\u001bh")).withZone(ZoneId.systemDefault());
        b = new SimpleDateFormat(wd_2.E("M\bM\by<P\u0015k9|\u001cY\u0002G"));
    }

    public static /* synthetic */ ud_0 ttw_tradefinder_ud_0_E(long a22) {
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

