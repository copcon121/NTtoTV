/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcast;

import com.bookmap.addons.broadcasting.api.view.BrDataStructureInterface;
import com.bookmap.addons.broadcasting.api.view.Event;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;
import velox.indicators.sionchart.broadcasting.implementations.StopEvent;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;

public class DataStructureInterfaceWrapper {
    private final Map<String, e_0> stopsByAlias = new ConcurrentHashMap<String, e_0>();
    private final Map<String, h> icebergsByAlias = new ConcurrentHashMap<String, h>();

    public BrDataStructureInterface create(String string, e_0 e_02, h h2) {
        this.stopsByAlias.put(string, e_02);
        this.icebergsByAlias.put(string, h2);
        return new BrDataStructureInterface(){

            @Override
            public List<BrDataStructureInterface.TreeResponseInterval> get(Class<?> clazz, String string, long l2, long l3, int n2, String string2, Class<?>[] classArray) {
                throw new UnsupportedOperationException("The add-on does not support events aggregation. Please use other methods.");
            }

            @Override
            public List<Object> get(Class<?> clazz, String string, long l2, long l3, String string2) {
                return new ArrayList<Object>(DataStructureInterfaceWrapper.this.getEvents(DataStructureInterfaceWrapper.this.stopsByAlias.get(string2), DataStructureInterfaceWrapper.this.icebergsByAlias.get(string2), l2, l3));
            }

            @Override
            public BrDataStructureInterface.TreeResponseInterval get(Class<?> clazz, String string, long l2, String string2, Class<?>[] classArray) {
                throw new UnsupportedOperationException("The add-on does not support events aggregation. Please use other methods.");
            }

            @Override
            public List<? extends Event> get(Class<?> clazz, String string, long l2, String string2) {
                return DataStructureInterfaceWrapper.this.getEvents(DataStructureInterfaceWrapper.this.stopsByAlias.get(string2), DataStructureInterfaceWrapper.this.icebergsByAlias.get(string2), 0L, l2);
            }
        };
    }

    private List<EventInterface> getEvents(e_0 e_02, h h2, long l2, long l3) {
        return this.getEvents(e_02, h2, l2, l3, new Class[]{IcebergEvent.class, StopEvent.class});
    }

    private List<EventInterface> getEvents(e_0 e_02, h h2, long l2, long l3, Class<?>[] classArray) {
        if (classArray.length == 1) {
            Class<?> clazz = classArray[0];
            if (clazz.getName().equals(StopEvent.class.getName())) {
                return this.getStops(e_02, l2, l3);
            }
            if (clazz.getName().equals(IcebergEvent.class.getName())) {
                return this.getIcebergs(h2, l2, l3);
            }
        } else {
            LinkedList<EventInterface> linkedList = new LinkedList<EventInterface>(this.getStops(e_02, l2, l3));
            LinkedList<EventInterface> linkedList2 = new LinkedList<EventInterface>(this.getIcebergs(h2, l2, l3));
            return this.mergeAndSortEvents(linkedList, linkedList2);
        }
        return new LinkedList<EventInterface>();
    }

    private List<EventInterface> getStops(e_0 e_02, long l2, long l3) {
        LinkedList<EventInterface> linkedList = new LinkedList<EventInterface>();
        for (g_0 g_02 : e_02.b) {
            linkedList.addAll(this.wrapEventsAndCheckByTime(g_02.a, l2, l3));
        }
        return linkedList;
    }

    private List<EventInterface> getIcebergs(h h2, long l2, long l3) {
        LinkedList<EventInterface> linkedList = new LinkedList<EventInterface>(this.wrapEventsAndCheckByTime(h2.g, l2, l3));
        LinkedList<EventInterface> linkedList2 = new LinkedList<EventInterface>(this.wrapEventsAndCheckByTime(h2.f, l2, l3));
        return this.mergeAndSortEvents(linkedList, linkedList2);
    }

    private List<EventInterface> wrapEventsAndCheckByTime(List<j> list, long l2, long l3) {
        ArrayList<EventInterface> arrayList = new ArrayList<EventInterface>();
        for (j j2 : list) {
            if (j2.c < l2 || j2.c > l3) continue;
            if (j2.b.equals((Object)OrderEventType.STOP)) {
                arrayList.add(new StopEvent(j2.a.e, j2.c, j2.d, j2.e, j2.a.f, j2.f));
                continue;
            }
            arrayList.add(new IcebergEvent(j2.a.e, OrderEventType.convert(j2.b), j2.c, j2.d, j2.e, j2.a.f, j2.f));
        }
        return arrayList;
    }

    private List<EventInterface> mergeAndSortEvents(List<EventInterface> list, List<EventInterface> list2) {
        LinkedList<EventInterface> linkedList = new LinkedList<EventInterface>(list);
        linkedList.addAll(list2);
        return linkedList.stream().sorted().collect(Collectors.toList());
    }
}

