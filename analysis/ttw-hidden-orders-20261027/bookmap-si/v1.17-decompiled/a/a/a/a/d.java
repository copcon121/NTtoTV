/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package a.a.a.a;

import velox.api.layer1.settings.StrategySettingsVersion;

@StrategySettingsVersion(currentVersion=1, compatibleVersions={})
public class d {
    private String token;
    private String chatId;
    private boolean enabled;

    public String getToken() {
        return this.token;
    }

    public void setToken(String string) {
        this.token = string;
    }

    public String getChatId() {
        return this.chatId;
    }

    public void setChatId(String string) {
        this.chatId = string;
    }

    public boolean isEnabled() {
        return this.enabled;
    }

    public void setEnabled(boolean bl) {
        this.enabled = bl;
    }

    public String toString() {
        return String.format("TelegramSettings, token: '%s', chatId: '%s', enabled '%s'", this.token, this.chatId, this.enabled);
    }
}

