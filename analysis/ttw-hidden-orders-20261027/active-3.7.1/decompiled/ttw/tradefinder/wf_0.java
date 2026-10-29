/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Color;
import java.util.HashMap;
import java.util.Map;
import ttw.tradefinder.ek;
import ttw.tradefinder.wa_2;

/*
 * Renamed from ttw.tradefinder.wf
 */
public class wf_0
extends wa_2<ek> {
    private Map<String, Color> c = new HashMap<String, Color>();

    public wf_0() {
        super(ek.class);
        wf_0 a2;
    }

    public Color E(String a2) {
        wf_0 a3;
        if (a3.c == null) {
            a3.c = new HashMap<String, Color>();
        }
        return a3.c.get(a2);
    }

    @Override
    public ek E() {
        wf_0 a2;
        ek ek2 = new ek();
        new ek().IsDefault = a2.b;
        ek ek3 = ek2;
        ek3.b(a2.c);
        return ek3;
    }

    @Override
    public void E(ek a2) {
        wf_0 a3;
        ek ek2 = a2;
        a3.b = ek2.IsDefault;
        ek2.a(a3.c);
    }

    public void E(String a2, Color a3) {
        wf_0 a4;
        if (a4.c == null) {
            a4.c = new HashMap<String, Color>();
        }
        a4.c.put(a2, a3);
    }
}

