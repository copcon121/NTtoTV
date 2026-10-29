/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.settings.StrategySettingsVersion
 */
package velox.indicators.sionchart;

import java.awt.Color;
import velox.api.layer1.settings.StrategySettingsVersion;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.TelegramSettingsExtended;

@StrategySettingsVersion(currentVersion=13, compatibleVersions={})
public class e {
    public static final Color AGGREGATION_LINE_DEFAULT_COLOR = new Color(255, 255, 0, 128);
    public Color icebergsAskColor = SitIndicator.c;
    public Color icebergsBidColor = SitIndicator.d;
    private Color icebergsHiddenAskColor;
    private Color icebergsHiddenBidColor;
    public int icebergsIconsHeight = 17;
    public int icebergsIconsOffset = 120;
    public int icebergsOrderLineWidth = 3;
    public int icebergsOffsetLineWidth = 2;
    public int icebergsThreshold = 0;
    public int icebergsAggThreshold = 0;
    public int icebergsPriceAreaMultiplier = 200;
    public int icebergsTimeAreaMultiplier = 10;
    public boolean showIcebergs = true;
    public boolean showDetection = false;
    public boolean showTrades = false;
    public boolean showExecution = true;
    public boolean showCancellation = true;
    public boolean showActive = true;
    public boolean showTotals = true;
    public boolean showLetters = false;
    public boolean showEventVolumes = false;
    public boolean applyThresholdToActive = false;
    public boolean icebergsAutoThreshold = false;
    public boolean showIcebergsNumber = false;
    public boolean aggregateEC = true;
    public int icebergsSdInterval = 60;
    public double icebergsSdMultiplier = 1.0;
    public boolean icebergsAlertEnabled = false;
    public String icebergsAlertTemplate = "Iceberg $INSTR $SIDE at $PRICE crossed $THRESHOLD";
    public int icebergsAlertThreshold = 10;
    public boolean icebergsAlertAutoThreshold = false;
    public int icebergsAlertSdInterval = 60;
    public double icebergsAlertSdMultiplier = 1.0;
    public boolean icebergsShowHiddenIcons = true;
    public int icebergsHiddenTransparency = 85;
    public boolean icebergsNotAggregated = false;
    public Color stopsAskColor = SitIndicator.e;
    public Color stopsBidColor = SitIndicator.f;
    public Color stopsHiddenAskColor;
    public Color stopsHiddenBidColor;
    public int stopsIconsHeight = 17;
    public int stopsIconsOffset = 80;
    public int stopsOrderLineWidth = 3;
    public int stopsOffsetLineWidth = 2;
    public int stopsThreshold = 0;
    public int stopsAggThreshold = 0;
    public int stopsPriceAreaMultiplier = 200;
    public int stopsTimeAreaMultiplier = 10;
    public boolean showStops = true;
    public boolean showStopsTotals = true;
    public boolean showStopsNumber = false;
    public boolean stopsAutoThreshold = false;
    public int stopsSdInterval = 60;
    public double stopsSdMultiplier = 1.0;
    public boolean stopsAlertEnabled = false;
    public String stopsAlertTemplate = "Stop $INSTR $SIDE at $PRICE volume $VOLUME";
    public int stopsAlertThreshold = 10;
    public boolean stopsAlertAutoThreshold = false;
    public int stopsAlertSdInterval = 60;
    public double stopsAlertSdMultiplier = 1.0;
    public boolean stopsShowHiddenIcons = true;
    public int stopsHiddenTransparency = 85;
    public boolean showOnlyStopsTBPL = false;
    public boolean showOnlyStopsTBPLAlerts = false;
    public boolean stopsNotAggregated = false;
    public boolean showAggregationLines = true;
    public Color aggregationLineColor = AGGREGATION_LINE_DEFAULT_COLOR;
    public TelegramSettingsExtended telegramSettings = new TelegramSettingsExtended();
    public boolean enableBroadcasting = false;

    private int getAlphaByTransparency(int n2) {
        return (int)((double)(100 - n2) * 2.55);
    }

    public Color getStopsHiddenAskColor() {
        return this.stopsHiddenAskColor;
    }

    public Color getStopsHiddenBidColor() {
        return this.stopsHiddenBidColor;
    }

    public Color getIcebergsHiddenAskColor() {
        return this.icebergsHiddenAskColor;
    }

    public Color getIcebergsHiddenBidColor() {
        return this.icebergsHiddenBidColor;
    }

    public void setHiddenColors() {
        int n2 = this.getAlphaByTransparency(this.icebergsHiddenTransparency);
        int n3 = this.getAlphaByTransparency(this.stopsHiddenTransparency);
        this.icebergsHiddenAskColor = new Color(this.icebergsAskColor.getRed(), this.icebergsAskColor.getGreen(), this.icebergsAskColor.getBlue(), n2);
        this.icebergsHiddenBidColor = new Color(this.icebergsBidColor.getRed(), this.icebergsBidColor.getGreen(), this.icebergsBidColor.getBlue(), n2);
        this.stopsHiddenAskColor = new Color(this.stopsAskColor.getRed(), this.stopsAskColor.getGreen(), this.stopsAskColor.getBlue(), n3);
        this.stopsHiddenBidColor = new Color(this.stopsBidColor.getRed(), this.stopsBidColor.getGreen(), this.stopsBidColor.getBlue(), n3);
    }
}

