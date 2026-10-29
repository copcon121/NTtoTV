/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import a.a.a.a.d;

public class TelegramSettingsExtended
extends d {
    private boolean a = false;
    private boolean b = false;

    public boolean a() {
        return this.b;
    }

    public void a(boolean bl) {
        this.b = bl;
        this.setEnabled(this.a || bl);
    }

    public boolean b() {
        return this.a;
    }

    public void b(boolean bl) {
        this.a = bl;
        this.setEnabled(bl || this.b);
    }
}

