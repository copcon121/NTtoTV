/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.Layer1ApiUserInterModuleMessage
 */
package velox.indicators.sionchart.broadcast;

import velox.api.layer1.messages.Layer1ApiUserInterModuleMessage;

public class UnsubscribeMessage
implements Layer1ApiUserInterModuleMessage {
    public final byte[] bytes;

    public UnsubscribeMessage(byte[] byArray) {
        this.bytes = byArray;
    }
}

