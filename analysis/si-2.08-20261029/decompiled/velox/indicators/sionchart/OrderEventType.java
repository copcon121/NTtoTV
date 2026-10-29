/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart;

import velox.indicators.sionchart.broadcasting.implementations.EventType;

public enum OrderEventType {
    DETECTION,
    MOVEMENT,
    CANCELLATION,
    EXECUTION,
    TRADE,
    ACTIVE,
    STOP;


    public static EventType convert(OrderEventType orderEventType) {
        return switch (orderEventType) {
            default -> throw new IncompatibleClassChangeError();
            case DETECTION -> EventType.DETECTION;
            case MOVEMENT -> EventType.MOVEMENT;
            case CANCELLATION -> EventType.CANCELLATION;
            case EXECUTION -> EventType.EXECUTION;
            case TRADE -> EventType.TRADE;
            case ACTIVE -> EventType.ACTIVE;
            case STOP -> EventType.STOP;
        };
    }
}

