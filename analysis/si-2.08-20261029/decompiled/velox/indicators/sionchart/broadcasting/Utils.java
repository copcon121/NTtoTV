/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.concurrent.TimeUnit;

public class Utils {
    private static final SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd HH:mm:ss.SSS");

    public static String nanosToDate(long l2) {
        return sdf.format(new Date(TimeUnit.NANOSECONDS.toMillis(l2)));
    }
}

