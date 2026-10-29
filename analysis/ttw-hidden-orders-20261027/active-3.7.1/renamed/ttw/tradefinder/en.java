/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package ttw.tradefinder;

import java.util.UUID;
import ttw.tradefinder.ia;
import ttw.tradefinder.te_0;
import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=1, compatibleVersions={1})
public class en
extends ia {
    public String b = UUID.randomUUID().toString().replace(te_0.E("\u0016"), "");

    public en() {
        en a2;
    }
}

