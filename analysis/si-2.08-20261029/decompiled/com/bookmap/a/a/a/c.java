/*
 * Decompiled with CFR 0.152.
 */
package com.bookmap.a.a.a;

public class c {
    public final String a;
    public final boolean b;
    public int c;
    public int d;
    private int f;
    private int g = 0;
    public boolean e = false;

    public c(String string, boolean bl, int n2, int n3) {
        this.a = string;
        this.b = bl;
        this.c = n2;
        this.d = n3;
        this.f = n3;
    }

    public int a() {
        return this.g;
    }

    public void a(int n2, int n3) {
        this.c = n2;
        this.d = n3;
        this.f = n3;
    }

    public void a(int n2) {
        this.g += n2;
        this.f -= n2;
    }

    public int b() {
        return this.f;
    }
}

