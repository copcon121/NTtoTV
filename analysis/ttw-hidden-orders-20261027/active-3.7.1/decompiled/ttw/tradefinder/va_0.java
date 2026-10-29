/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.f;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.Va
 */
public class va_0
extends wa_2<f> {
    public boolean c;

    public va_0(boolean a2) {
        va_0 a3;
        va_0 va_02 = a3;
        super(f.class);
        va_02.c = false;
        va_02.c = a2;
    }

    @Override
    public void E(f a2) {
        va_0 a3;
        va_0 va_02 = a3;
        va_02.b = a2.IsDefault;
        va_02.c = a2.a;
    }

    public va_0() {
        a2(false);
        va_0 a2;
    }

    @Override
    public f E() {
        va_0 a2;
        f f2 = new f();
        new f().IsDefault = a2.b;
        f2.a = a2.c;
        return f2;
    }
}

