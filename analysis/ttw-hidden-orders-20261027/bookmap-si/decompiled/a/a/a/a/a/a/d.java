/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 */
package a.a.a.a.a.a;

import org.apache.commons.lang3.StringUtils;

public final class d {
    private final boolean a;
    private final String b;

    public d(boolean bl, String string) {
        this.a = bl;
        this.b = StringUtils.defaultString((String)string);
    }

    public boolean a() {
        return this.a;
    }

    public String b() {
        return this.b;
    }

    public String toString() {
        return String.format("[response], success: %s, '%s'", this.a, this.b);
    }
}

