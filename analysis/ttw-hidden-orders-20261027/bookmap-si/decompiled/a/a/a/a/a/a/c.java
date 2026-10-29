/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.StringUtils
 */
package a.a.a.a.a.a;

import org.apache.commons.lang3.StringUtils;

public final class c {
    private final String a;

    public c(String string) {
        this.a = StringUtils.defaultString((String)string);
    }

    public String a() {
        return this.a;
    }

    public String toString() {
        return String.format("[request], token: '%s'", this.a);
    }
}

