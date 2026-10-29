/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.da_0;
import ttw.tradefinder.go;
import ttw.tradefinder.ia;
import ttw.tradefinder.na;
import ttw.tradefinder.ub;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=4, compatibleVersions={4})
public class in
extends ia {
    public na j;
    public boolean b;
    public na h;
    public Color k;
    public Color e;
    public da_0 f;
    public int d;
    public int c;
    public go i;
    public na g;

    public in() {
        in a2;
        in in2 = a2;
        in in3 = a2;
        in in4 = a2;
        a2.b = true;
        in4.c = 20;
        in4.d = 10;
        in3.e = Color.decode(ub.E("X\"9 CS="));
        in2.k = Color.decode(ae_1.E("\u0002Bg=g5b"));
        in3.f = da_0.b;
        in2.g = na.b;
        in2.h = na.b;
        in2.j = na.b;
        in2.i = new go();
    }
}

