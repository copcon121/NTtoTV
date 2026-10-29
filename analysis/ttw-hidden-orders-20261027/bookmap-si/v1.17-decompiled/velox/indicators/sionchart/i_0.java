/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import java.util.function.Consumer;
import velox.indicators.sionchart.broadcast.Subscription;

/*
 * Renamed from velox.indicators.sionchart.I
 */
public class i_0 {
    public final Subscription a;
    public Consumer<byte[]> b;
    public Consumer<byte[]> c;

    public i_0(Subscription subscription, Consumer<byte[]> consumer, Consumer<byte[]> consumer2) {
        this.a = subscription;
        this.b = consumer;
        this.c = consumer2;
    }
}

