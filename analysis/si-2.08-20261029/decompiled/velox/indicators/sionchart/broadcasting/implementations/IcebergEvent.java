/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting.implementations;

import com.bookmap.addons.broadcasting.api.annotations.BrApiModuleComponent;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.Utils;
import velox.indicators.sionchart.broadcasting.implementations.EventType;

@BrApiModuleComponent(version=1, backwardCompatibility=false)
public class IcebergEvent
implements EventInterface {
    private static final long serialVersionUID = 6063625346922021478L;
    private final String orderId;
    private final EventType type;
    private final long time;
    private final int price;
    private final int size;
    private final boolean isBid;
    private final int totalSize;

    public IcebergEvent(String string, EventType eventType, long l2, int n2, int n3, boolean bl, int n4) {
        this.type = eventType;
        this.price = n2;
        this.time = l2;
        this.size = n3;
        this.orderId = string;
        this.isBid = bl;
        this.totalSize = n4;
    }

    @Override
    public String getOrderId() {
        return this.orderId;
    }

    @Override
    public EventType getType() {
        return this.type;
    }

    @Override
    public int getPrice() {
        return this.price;
    }

    @Override
    public int getSize() {
        return this.size;
    }

    @Override
    public boolean isBid() {
        return this.isBid;
    }

    @Override
    public int getTotalSize() {
        return this.totalSize;
    }

    @Override
    public long getTime() {
        return this.time;
    }

    public String toString() {
        return "IcebergEvent{orderId=" + this.orderId + ", type=" + this.type + ", time=" + this.time + ", dateTime=" + Utils.nanosToDate(this.time) + ", price=" + this.price + ", size=" + this.size + ", totalSize=" + this.totalSize + ", isBid=" + this.isBid + "}";
    }
}

