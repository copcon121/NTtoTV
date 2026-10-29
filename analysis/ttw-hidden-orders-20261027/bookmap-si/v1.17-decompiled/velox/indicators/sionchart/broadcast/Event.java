/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcast;

import java.io.Serializable;
import velox.indicators.sionchart.OrderEventType;

public class Event
implements Serializable {
    private static final long serialVersionUID = 1L;
    public String alias;
    public final String orderId;
    public final OrderEventType type;
    public final long time;
    public final int price;
    public final int size;
    public final boolean isBid;
    public final int totalSize;

    public Event(String string, OrderEventType orderEventType, long l2, int n2, int n3, boolean bl, int n4) {
        this.type = orderEventType;
        this.price = n2;
        this.time = l2;
        this.size = n3;
        this.orderId = string;
        this.isBid = bl;
        this.totalSize = n4;
    }

    public Event(String string, OrderEventType orderEventType, long l2, int n2, int n3, boolean bl, int n4, String string2) {
        this(string, orderEventType, l2, n2, n3, bl, n4);
        this.alias = string2;
    }

    public String toString() {
        return "Event{orderId=" + this.orderId + ", type=" + this.type + ", time=" + this.time + ", price=" + this.price + ", size=" + this.size + ", totalSize=" + this.totalSize + ", isBid=" + this.isBid + "}";
    }
}

