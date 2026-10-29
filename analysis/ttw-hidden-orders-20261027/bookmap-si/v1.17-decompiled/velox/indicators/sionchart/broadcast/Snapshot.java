/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcast;

import java.io.Serializable;
import java.util.List;
import velox.indicators.sionchart.broadcast.Event;
import velox.indicators.sionchart.broadcast.SubscriptionType;

public class Snapshot
implements Serializable {
    private static final long serialVersionUID = 1L;
    public final List<Event> events;
    public final String alias;
    public final SubscriptionType type;

    public Snapshot(List<Event> list, String string, SubscriptionType subscriptionType) {
        this.events = list;
        this.alias = string;
        this.type = subscriptionType;
    }
}

