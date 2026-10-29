/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting;

import com.bookmap.addons.broadcasting.api.annotations.BrApiModuleComponent;
import com.bookmap.addons.broadcasting.api.view.Event;
import java.io.Serializable;
import velox.indicators.sionchart.broadcasting.implementations.EventType;

@BrApiModuleComponent(version=1, backwardCompatibility=false)
public interface EventInterface
extends Event,
Serializable,
Comparable<EventInterface> {
    public String getOrderId();

    public EventType getType();

    public int getPrice();

    public int getSize();

    public boolean isBid();

    public int getTotalSize();

    @Override
    default public int compareTo(EventInterface eventInterface) {
        return Long.compare(this.getTime(), eventInterface.getTime());
    }
}

