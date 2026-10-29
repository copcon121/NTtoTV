/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.a.a;

import a.a.a.a.a.a.d;
import org.apache.commons.lang3.Validate;

public final class f {
    private final d a;

    public static f a(d d2) {
        Validate.notNull((Object)d2);
        return new f(d2);
    }

    private f(d d2) {
        Validate.notNull((Object)d2);
        this.a = d2;
    }

    public d a() {
        return this.a;
    }

    public String toString() {
        return String.format("Telegram sendMessage() %s", this.a);
    }
}

