package com.nttotv.diagnostics;

import java.lang.reflect.Method;
import java.util.Set;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.implementations.EventType;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;

/** Read only the shipped public event DTO contract across addon classloaders. */
final class Si2PublicEventReader {
    private static final String PREFIX = "velox.indicators.sionchart.broadcasting.implementations.";
    private static final Set<String> CLASSES = Set.of(PREFIX + "IcebergEvent", PREFIX + "StopEvent");

    private Si2PublicEventReader() { }

    static EventInterface read(Object value) throws ReflectiveOperationException {
        if (value == null || !CLASSES.contains(value.getClass().getName())) {
            throw new IllegalArgumentException("Unrecognized public SI DTO");
        }
        // No getDeclaredMethod/getDeclaredField/setAccessible/private access.
        Object rawType = getter(value, "getType", null);
        if (!(rawType instanceof Enum<?>) || !rawType.getClass().getName().equals(PREFIX + "EventType")) {
            throw new IllegalArgumentException("Unrecognized public SI event type");
        }
        EventType type = EventType.valueOf(((Enum<?>) rawType).name());
        String id = (String) getter(value, "getOrderId", String.class);
        long time = (Long) getter(value, "getTime", long.class);
        int price = (Integer) getter(value, "getPrice", int.class);
        int size = (Integer) getter(value, "getSize", int.class);
        boolean bid = (Boolean) getter(value, "isBid", boolean.class);
        int total = (Integer) getter(value, "getTotalSize", int.class);
        return new IcebergEvent(id, type, time, price, size, bid, total);
    }

    private static Object getter(Object value, String name, Class<?> resultType)
            throws ReflectiveOperationException {
        Method method = value.getClass().getMethod(name);
        if (method.getParameterCount() != 0
            || resultType != null && method.getReturnType() != resultType) {
            throw new IllegalArgumentException("Unexpected public SI getter signature");
        }
        return method.invoke(value);
    }
}
