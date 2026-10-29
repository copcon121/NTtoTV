/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting.implementations;

import com.bookmap.addons.broadcasting.api.annotations.BrApiModuleComponent;

@BrApiModuleComponent(version=1, backwardCompatibility=false)
public enum EventType {
    DETECTION,
    MOVEMENT,
    CANCELLATION,
    EXECUTION,
    TRADE,
    ACTIVE,
    STOP;

}

