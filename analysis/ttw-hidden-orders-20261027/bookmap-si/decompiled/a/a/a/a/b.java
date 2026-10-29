/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.Validate
 */
package a.a.a.a;

import a.a.a.a.c;
import java.util.function.Consumer;
import org.apache.commons.lang3.Validate;

public interface b {
    public static b a(Consumer<String> consumer) {
        Validate.notNull(consumer);
        return new c(consumer);
    }

    public void a(String var1);

    public void b(String var1);
}

