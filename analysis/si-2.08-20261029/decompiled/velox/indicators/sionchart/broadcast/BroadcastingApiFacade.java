/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.Layer1ApiProvider
 */
package velox.indicators.sionchart.broadcast;

import com.bookmap.addons.broadcasting.api.view.BrDataStructureInterface;
import com.bookmap.addons.broadcasting.api.view.BroadcasterProvider;
import com.bookmap.addons.broadcasting.api.view.Event;
import com.bookmap.addons.broadcasting.api.view.listeners.LiveEventListener;
import com.bookmap.addons.broadcasting.implementations.view.BroadcastFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import velox.api.layer1.Layer1ApiProvider;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.broadcast.DataStructureInterfaceWrapper;
import velox.indicators.sionchart.broadcasting.EventInterface;
import velox.indicators.sionchart.broadcasting.SitSettings;
import velox.indicators.sionchart.broadcasting.implementations.IcebergEvent;
import velox.indicators.sionchart.broadcasting.implementations.StopEvent;
import velox.indicators.sionchart.broadcasting.implementations.ThresholdFilter;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.m;

public class BroadcastingApiFacade {
    private static volatile BroadcastingApiFacade facade;
    private final List<String> aliases = Collections.synchronizedList(new ArrayList());
    private final AtomicBoolean isBrapiStarted = new AtomicBoolean(false);
    private final AtomicBoolean waitingForInitialization = new AtomicBoolean(false);
    private final BroadcasterProvider broadcaster;
    private final DataStructureInterfaceWrapper dataStructureInterfaceWrapper;
    private AtomicBoolean available = null;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public static BroadcastingApiFacade getInstance(Layer1ApiProvider layer1ApiProvider, String string, Class<? extends m> clazz) {
        if (facade != null) return facade;
        Class<BroadcastingApiFacade> clazz2 = BroadcastingApiFacade.class;
        synchronized (BroadcastingApiFacade.class) {
            if (facade != null) return facade;
            facade = new BroadcastingApiFacade(layer1ApiProvider, string, clazz);
            // ** MonitorExit[var3_3] (shouldn't be in output)
            return facade;
        }
    }

    private static synchronized void reset() {
        facade = null;
    }

    private BroadcastingApiFacade(Layer1ApiProvider layer1ApiProvider, String string, Class<? extends m> clazz) {
        this.broadcaster = BroadcastFactory.getBroadcasterProvider(layer1ApiProvider, string, clazz);
        this.broadcaster.checkUserLicenses("2050-01-01 00:00:00");
        this.dataStructureInterfaceWrapper = new DataStructureInterfaceWrapper();
    }

    public void setAvailable(boolean bl) {
        this.available = new AtomicBoolean(bl);
        if (this.waitingForInitialization.get()) {
            this.start();
        }
    }

    public void sendEvent(String string, j j2) {
        Map<String, LiveEventListener> map = this.broadcaster.getListenersLiveDates(string);
        for (LiveEventListener liveEventListener : map.values()) {
            EventInterface eventInterface = this.wrapEventInProxy(j2);
            liveEventListener.giveEvent(eventInterface);
        }
    }

    private EventInterface wrapEventInProxy(j j2) {
        OrderEventType orderEventType = j2.b;
        if (orderEventType.equals((Object)OrderEventType.STOP)) {
            return new StopEvent(j2.a.e, j2.c, j2.d, j2.e, j2.a.f, j2.f);
        }
        return new IcebergEvent(j2.a.e, OrderEventType.convert(j2.b), j2.c, j2.d, j2.e, j2.a.f, j2.f);
    }

    public synchronized void startAlias(String string, e e2) {
        this.aliases.add(string);
        this.start();
        this.broadcaster.registerGenerator(string, new HashSet<Class<? extends Event>>(Arrays.asList(IcebergEvent.class, StopEvent.class)), new ThresholdFilter(e2.icebergsThreshold, e2.stopsThreshold), this.wrapSettingsInProxy(e2));
    }

    public synchronized void stopAlias(String string) {
        this.broadcaster.removeGenerator(string);
        this.aliases.remove(string);
        this.finishIfNeed();
    }

    private void start() {
        if (!this.isBrapiStarted.get()) {
            if (this.available != null) {
                this.waitingForInitialization.set(false);
                if (this.available.get() && !this.aliases.isEmpty()) {
                    this.broadcaster.start();
                    this.isBrapiStarted.set(true);
                }
            } else {
                this.waitingForInitialization.set(true);
            }
        }
    }

    private void finishIfNeed() {
        if (this.aliases.isEmpty()) {
            this.broadcaster.finish();
            this.isBrapiStarted.set(false);
            BroadcastingApiFacade.reset();
        }
    }

    public void registerData(String string, e_0 e_02, h h2) {
        BrDataStructureInterface brDataStructureInterface = this.dataStructureInterfaceWrapper.create(string, e_02, h2);
        this.broadcaster.registerDataStructureInterface(brDataStructureInterface, object -> {
            if (object instanceof StopEvent) {
                return (StopEvent)object;
            }
            if (object instanceof IcebergEvent) {
                return (IcebergEvent)object;
            }
            return null;
        });
    }

    public void updateFilter(String string, int n2, int n3) {
        this.broadcaster.updateFilter(string, new ThresholdFilter(n2, n3));
    }

    public void updateSettings(String string, e e2) {
        this.broadcaster.updateSettings(string, this.wrapSettingsInProxy(e2));
    }

    private SitSettings wrapSettingsInProxy(e e2) {
        return new SitSettings(e2.icebergsAskColor, e2.icebergsBidColor, e2.getIcebergsHiddenAskColor(), e2.getIcebergsHiddenBidColor(), e2.icebergsIconsHeight, e2.icebergsIconsOffset, e2.icebergsOrderLineWidth, e2.icebergsOffsetLineWidth, e2.icebergsThreshold, e2.icebergsAggThreshold, e2.icebergsPriceAreaMultiplier, e2.icebergsTimeAreaMultiplier, e2.showIcebergs, e2.showDetection, e2.showTrades, e2.showExecution, e2.showCancellation, e2.showActive, e2.showTotals, e2.showLetters, e2.showEventVolumes, e2.applyThresholdToActive, e2.icebergsAutoThreshold, e2.showIcebergsNumber, e2.aggregateEC, e2.icebergsSdInterval, e2.icebergsSdMultiplier, e2.icebergsAlertEnabled, e2.icebergsAlertTemplate, e2.icebergsAlertThreshold, e2.icebergsAlertAutoThreshold, e2.icebergsAlertSdInterval, e2.icebergsAlertSdMultiplier, e2.icebergsShowHiddenIcons, e2.icebergsHiddenTransparency, e2.icebergsNotAggregated, e2.stopsAskColor, e2.stopsBidColor, e2.stopsHiddenAskColor, e2.stopsHiddenBidColor, e2.stopsIconsHeight, e2.stopsIconsOffset, e2.stopsOrderLineWidth, e2.stopsOffsetLineWidth, e2.stopsThreshold, e2.stopsAggThreshold, e2.stopsPriceAreaMultiplier, e2.stopsTimeAreaMultiplier, e2.showStops, e2.showStopsTotals, e2.showStopsNumber, e2.stopsAutoThreshold, e2.stopsSdInterval, e2.stopsSdMultiplier, e2.stopsAlertEnabled, e2.stopsAlertTemplate, e2.stopsAlertThreshold, e2.stopsAlertAutoThreshold, e2.stopsAlertSdInterval, e2.stopsAlertSdMultiplier, e2.stopsShowHiddenIcons, e2.stopsHiddenTransparency, e2.showOnlyStopsTBPL, e2.showOnlyStopsTBPLAlerts, e2.stopsNotAggregated, e2.showAggregationLines, e2.aggregationLineColor, e2.telegramSettings.a(), e2.telegramSettings.a());
    }
}

