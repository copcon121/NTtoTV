/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage$SoundAlertStatus
 *  velox.api.layer1.messages.Layer1ApiSoundAlertMessage$SoundAlertStatusListener
 */
package velox.indicators.sionchart.b;

import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;

public class b
implements Layer1ApiSoundAlertMessage.SoundAlertStatusListener {
    public Layer1ApiSoundAlertMessage.SoundAlertStatus a;

    public void onSoundAlertStatus(String string, Layer1ApiSoundAlertMessage.SoundAlertStatus soundAlertStatus) {
        this.a = soundAlertStatus;
    }
}

