/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.google.gson.JsonElement
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.a.a;

import a.a.a.a.a.a.d;
import a.a.a.a.c.a;
import com.google.gson.JsonElement;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Validate;

public final class b {
    private static final String a = "result.username";
    private final d b;
    private final String c;

    public static b a(d d2) {
        Validate.notNull((Object)d2);
        if (!d2.a()) {
            return new b(d2, "");
        }
        JsonElement jsonElement = a.a.a.a.c.a.a(d2.b(), a);
        String string = jsonElement == null ? "" : jsonElement.getAsString();
        return new b(d2, string);
    }

    private b(d d2, String string) {
        Validate.notNull((Object)d2);
        this.b = d2;
        this.c = StringUtils.defaultString((String)string);
    }

    public d a() {
        return this.b;
    }

    public String b() {
        return this.c;
    }

    public String toString() {
        return String.format("Telegram getMe() %s, username: '%s'", this.b, this.c);
    }
}

