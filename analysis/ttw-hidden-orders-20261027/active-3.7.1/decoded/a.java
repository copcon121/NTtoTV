/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.awt.Color;
import ttw.tradefinder.ca_0;
import ttw.tradefinder.ia;
import ttw.tradefinder.ia_0;
import ttw.tradefinder.ma_0;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=2, compatibleVersions={2})
public class a
extends ia {
    public int c;
    public Color e;
    public ma_0 b;
    public ia_0 a;
    public ca_0 d;

    public a() {
        a a2;
        a a3 = a2;
        a a4 = a2;
        a2.a = ia_0.c;
        a4.b = ma_0.b;
        a3.c = 60;
        a4.d = ca_0.a;
        a3.e = Color.WHITE;
    }
}

