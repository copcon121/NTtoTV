/*
 * Decompiled with CFR 0.152.
 */
package velox.bookmap;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.time.temporal.TemporalAccessor;
import java.util.Map;

public class ep {
    private static boolean a(String string) {
        try {
            Instant instant = ep.b(string);
            boolean bl = instant.isAfter(Instant.now());
            return bl;
        }
        catch (NullPointerException | NumberFormatException | DateTimeParseException runtimeException) {
            return false;
        }
    }

    private static Instant b(String string) {
        DateTimeFormatterBuilder dateTimeFormatterBuilder = new DateTimeFormatterBuilder().appendPattern("[yyyy-MM-dd[ HH[:mm[:ss]]]").parseDefaulting(ChronoField.HOUR_OF_DAY, 23L).parseDefaulting(ChronoField.MINUTE_OF_HOUR, 59L).parseDefaulting(ChronoField.SECOND_OF_MINUTE, 59L).parseDefaulting(ChronoField.NANO_OF_SECOND, 0L);
        DateTimeFormatter dateTimeFormatter = dateTimeFormatterBuilder.toFormatter();
        dateTimeFormatter = dateTimeFormatter.withZone(ZoneId.of("GMT"));
        TemporalAccessor temporalAccessor = dateTimeFormatter.parse(string);
        Instant instant = Instant.from(temporalAccessor);
        return instant;
    }

    public static boolean a(Map<String, String> map) {
        return ep.a(map.get("Rithmic.LiveTrading"));
    }
}

