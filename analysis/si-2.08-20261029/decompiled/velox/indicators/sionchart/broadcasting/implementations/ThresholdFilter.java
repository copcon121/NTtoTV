/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting.implementations;

import com.bookmap.addons.broadcasting.api.annotations.BrApiModuleComponent;
import com.bookmap.addons.broadcasting.api.view.EventFilter;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;
import velox.indicators.sionchart.broadcasting.implementations.StopEvent;

@BrApiModuleComponent(version=1, backwardCompatibility=false)
public class ThresholdFilter<T extends EventInterface>
implements EventFilter<T> {
    private static final long serialVersionUID = -1770099922591575209L;
    private final int icebergThreshold;
    private final int stopsThreshold;

    public ThresholdFilter(int n2, int n3) {
        this.icebergThreshold = n2;
        this.stopsThreshold = n3;
    }

    @Override
    public T toFilter(T t2) {
        if (t2 != null && (t2 instanceof StopEvent ? t2.getTotalSize() >= this.stopsThreshold : t2 instanceof IcebergEvent && t2.getTotalSize() >= this.icebergThreshold)) {
            return t2;
        }
        return null;
    }
}

