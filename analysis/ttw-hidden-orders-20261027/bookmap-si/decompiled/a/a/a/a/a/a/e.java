/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.a.a;

import a.a.a.a.a.a.c;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Validate;

public final class e {
    private final c a;
    private final String b;
    private final String c;

    public e(c c2, String string, String string2) {
        Validate.notNull((Object)c2);
        this.a = c2;
        this.b = StringUtils.defaultString((String)string);
        this.c = StringUtils.defaultString((String)string2);
    }

    public c a() {
        return this.a;
    }

    public String b() {
        return this.b;
    }

    public String c() {
        return this.c;
    }

    public String toString() {
        return String.format("Telegram sendMessage() %s, chatId: '%s', message: '%s'", this.a, this.b, this.c);
    }
}

