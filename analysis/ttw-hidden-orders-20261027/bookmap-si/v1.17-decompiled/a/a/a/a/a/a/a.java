/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a.a.a;

import a.a.a.a.a.a.c;
import org.apache.commons.lang3.Validate;

public final class a {
    private final c a;

    public a(c c2) {
        Validate.notNull((Object)c2);
        this.a = c2;
    }

    public c a() {
        return this.a;
    }

    public String toString() {
        return String.format("Telegram getMe() %s", this.a);
    }
}

