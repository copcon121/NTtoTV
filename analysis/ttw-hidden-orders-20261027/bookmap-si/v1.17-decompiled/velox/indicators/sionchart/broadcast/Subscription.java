/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcast;

import java.io.Serializable;
import velox.indicators.sionchart.broadcast.SubscriptionType;

public class Subscription
implements Serializable {
    private static final long serialVersionUID = 1L;
    public final String subscriber;
    public final String alias;
    public final SubscriptionType type;

    public Subscription(String string, String string2, SubscriptionType subscriptionType) {
        this.subscriber = string;
        this.alias = string2;
        this.type = subscriptionType;
    }
}

