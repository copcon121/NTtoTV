/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.Layer1ApiUserInterModuleMessage
 */
package velox.indicators.sionchart.broadcast;

import java.util.function.Consumer;
import velox.api.layer1.messages.Layer1ApiUserInterModuleMessage;

public class SubscribeMessage
implements Layer1ApiUserInterModuleMessage {
    public final byte[] bytes;
    public final Consumer<byte[]> snapshotsConsumer;
    public final Consumer<byte[]> eventsConsumer;

    public SubscribeMessage(byte[] byArray, Consumer<byte[]> consumer, Consumer<byte[]> consumer2) {
        this.bytes = byArray;
        this.snapshotsConsumer = consumer;
        this.eventsConsumer = consumer2;
    }
}

