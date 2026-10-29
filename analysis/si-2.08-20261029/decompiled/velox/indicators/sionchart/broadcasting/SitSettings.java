/*
 * Decompiled with CFR 0.152.
 */
package velox.indicators.sionchart.broadcasting;

import com.bookmap.addons.broadcasting.api.annotations.BrApiModuleComponent;
import java.awt.Color;
import java.io.Serializable;

@BrApiModuleComponent(version=1, backwardCompatibility=false)
public class SitSettings
implements Serializable {
    private static final long serialVersionUID = 6850561316114906484L;
    private static final Color AGGREGATION_LINE_DEFAULT_COLOR = new Color(255, 255, 0, 128);
    private Color icebergsAskColor;
    private Color icebergsBidColor;
    private Color icebergsHiddenAskColor;
    private Color icebergsHiddenBidColor;
    private int icebergsIconsHeight = 17;
    private int icebergsIconsOffset = 120;
    private int icebergsOrderLineWidth = 3;
    private int icebergsOffsetLineWidth = 2;
    private int icebergsThreshold = 0;
    private int icebergsAggThreshold = 0;
    private int icebergsPriceAreaMultiplier = 200;
    private int icebergsTimeAreaMultiplier = 10;
    private boolean showIcebergs = true;
    private boolean showDetection = false;
    private boolean showTrades = false;
    private boolean showExecution = true;
    private boolean showCancellation = true;
    private boolean showActive = true;
    private boolean showTotals = true;
    private boolean showLetters = false;
    private boolean showEventVolumes = false;
    private boolean applyThresholdToActive = false;
    private boolean icebergsAutoThreshold = false;
    private boolean showIcebergsNumber = false;
    private boolean aggregateEC = true;
    private int icebergsSdInterval = 60;
    private double icebergsSdMultiplier = 1.0;
    private boolean icebergsAlertEnabled = false;
    private String icebergsAlertTemplate;
    private int icebergsAlertThreshold = 10;
    private boolean icebergsAlertAutoThreshold = false;
    private int icebergsAlertSdInterval = 60;
    private double icebergsAlertSdMultiplier = 1.0;
    private boolean icebergsShowHiddenIcons = true;
    private int icebergsHiddenTransparency = 85;
    private boolean icebergsNotAggregated = false;
    private Color stopsAskColor;
    private Color stopsBidColor;
    private Color stopsHiddenAskColor;
    private Color stopsHiddenBidColor;
    private int stopsIconsHeight = 17;
    private int stopsIconsOffset = 80;
    private int stopsOrderLineWidth = 3;
    private int stopsOffsetLineWidth = 2;
    private int stopsThreshold = 0;
    private int stopsAggThreshold = 0;
    private int stopsPriceAreaMultiplier = 200;
    private int stopsTimeAreaMultiplier = 10;
    private boolean showStops = true;
    private boolean showStopsTotals = true;
    private boolean showStopsNumber = false;
    private boolean stopsAutoThreshold = false;
    private int stopsSdInterval = 60;
    private double stopsSdMultiplier = 1.0;
    private boolean stopsAlertEnabled = false;
    private String stopsAlertTemplate;
    private int stopsAlertThreshold = 10;
    private boolean stopsAlertAutoThreshold = false;
    private int stopsAlertSdInterval = 60;
    private double stopsAlertSdMultiplier = 1.0;
    private boolean stopsShowHiddenIcons = true;
    private int stopsHiddenTransparency = 85;
    private boolean showOnlyStopsTBPL = false;
    private boolean showOnlyStopsTBPLAlerts = false;
    private boolean stopsNotAggregated = false;
    private boolean showAggregationLines = true;
    private Color aggregationLineColor = SitSettings.getAggregationLineDefaultColor();
    private boolean telegramIsEnabledForIcebergs;
    private boolean telegramIisEnabledForStops;
    private boolean enableBroadcasting = false;

    public SitSettings(Color color, Color color2, Color color3, Color color4, int n2, int n3, int n4, int n5, int n6, int n7, int n8, int n9, boolean bl, boolean bl2, boolean bl3, boolean bl4, boolean bl5, boolean bl6, boolean bl7, boolean bl8, boolean bl9, boolean bl10, boolean bl11, boolean bl12, boolean bl13, int n10, double d2, boolean bl14, String string, int n11, boolean bl15, int n12, double d3, boolean bl16, int n13, boolean bl17, Color color5, Color color6, Color color7, Color color8, int n14, int n15, int n16, int n17, int n18, int n19, int n20, int n21, boolean bl18, boolean bl19, boolean bl20, boolean bl21, int n22, double d4, boolean bl22, String string2, int n23, boolean bl23, int n24, double d5, boolean bl24, int n25, boolean bl25, boolean bl26, boolean bl27, boolean bl28, Color color9, boolean bl29, boolean bl30) {
        this.icebergsAskColor = color;
        this.icebergsBidColor = color2;
        this.icebergsHiddenAskColor = color3;
        this.icebergsHiddenBidColor = color4;
        this.icebergsIconsHeight = n2;
        this.icebergsIconsOffset = n3;
        this.icebergsOrderLineWidth = n4;
        this.icebergsOffsetLineWidth = n5;
        this.icebergsThreshold = n6;
        this.icebergsAggThreshold = n7;
        this.icebergsPriceAreaMultiplier = n8;
        this.icebergsTimeAreaMultiplier = n9;
        this.showIcebergs = bl;
        this.showDetection = bl2;
        this.showTrades = bl3;
        this.showExecution = bl4;
        this.showCancellation = bl5;
        this.showActive = bl6;
        this.showTotals = bl7;
        this.showLetters = bl8;
        this.showEventVolumes = bl9;
        this.applyThresholdToActive = bl10;
        this.icebergsAutoThreshold = bl11;
        this.showIcebergsNumber = bl12;
        this.aggregateEC = bl13;
        this.icebergsSdInterval = n10;
        this.icebergsSdMultiplier = d2;
        this.icebergsAlertEnabled = bl14;
        this.icebergsAlertTemplate = string;
        this.icebergsAlertThreshold = n11;
        this.icebergsAlertAutoThreshold = bl15;
        this.icebergsAlertSdInterval = n12;
        this.icebergsAlertSdMultiplier = d3;
        this.icebergsShowHiddenIcons = bl16;
        this.icebergsHiddenTransparency = n13;
        this.icebergsNotAggregated = bl17;
        this.stopsAskColor = color5;
        this.stopsBidColor = color6;
        this.stopsHiddenAskColor = color7;
        this.stopsHiddenBidColor = color8;
        this.stopsIconsHeight = n14;
        this.stopsIconsOffset = n15;
        this.stopsOrderLineWidth = n16;
        this.stopsOffsetLineWidth = n17;
        this.stopsThreshold = n18;
        this.stopsAggThreshold = n19;
        this.stopsPriceAreaMultiplier = n20;
        this.stopsTimeAreaMultiplier = n21;
        this.showStops = bl18;
        this.showStopsTotals = bl19;
        this.showStopsNumber = bl20;
        this.stopsAutoThreshold = bl21;
        this.stopsSdInterval = n22;
        this.stopsSdMultiplier = d4;
        this.stopsAlertEnabled = bl22;
        this.stopsAlertTemplate = string2;
        this.stopsAlertThreshold = n23;
        this.stopsAlertAutoThreshold = bl23;
        this.stopsAlertSdInterval = n24;
        this.stopsAlertSdMultiplier = d5;
        this.stopsShowHiddenIcons = bl24;
        this.stopsHiddenTransparency = n25;
        this.showOnlyStopsTBPL = bl25;
        this.showOnlyStopsTBPLAlerts = bl26;
        this.stopsNotAggregated = bl27;
        this.showAggregationLines = bl28;
        this.aggregationLineColor = color9;
        this.telegramIsEnabledForIcebergs = bl29;
        this.telegramIisEnabledForStops = bl30;
    }

    public static Color getAggregationLineDefaultColor() {
        return AGGREGATION_LINE_DEFAULT_COLOR;
    }

    public Color getIcebergsAskColor() {
        return this.icebergsAskColor;
    }

    public Color getIcebergsBidColor() {
        return this.icebergsBidColor;
    }

    public Color getIcebergsHiddenAskColor() {
        return this.icebergsHiddenAskColor;
    }

    public Color getIcebergsHiddenBidColor() {
        return this.icebergsHiddenBidColor;
    }

    public int getIcebergsIconsHeight() {
        return this.icebergsIconsHeight;
    }

    public int getIcebergsIconsOffset() {
        return this.icebergsIconsOffset;
    }

    public int getIcebergsOrderLineWidth() {
        return this.icebergsOrderLineWidth;
    }

    public int getIcebergsOffsetLineWidth() {
        return this.icebergsOffsetLineWidth;
    }

    public int getIcebergsThreshold() {
        return this.icebergsThreshold;
    }

    public int getIcebergsAggThreshold() {
        return this.icebergsAggThreshold;
    }

    public int getIcebergsPriceAreaMultiplier() {
        return this.icebergsPriceAreaMultiplier;
    }

    public int getIcebergsTimeAreaMultiplier() {
        return this.icebergsTimeAreaMultiplier;
    }

    public boolean isShowIcebergs() {
        return this.showIcebergs;
    }

    public boolean isShowDetection() {
        return this.showDetection;
    }

    public boolean isShowTrades() {
        return this.showTrades;
    }

    public boolean isShowExecution() {
        return this.showExecution;
    }

    public boolean isShowCancellation() {
        return this.showCancellation;
    }

    public boolean isShowActive() {
        return this.showActive;
    }

    public boolean isShowTotals() {
        return this.showTotals;
    }

    public boolean isShowLetters() {
        return this.showLetters;
    }

    public boolean isShowEventVolumes() {
        return this.showEventVolumes;
    }

    public boolean isApplyThresholdToActive() {
        return this.applyThresholdToActive;
    }

    public boolean isIcebergsAutoThreshold() {
        return this.icebergsAutoThreshold;
    }

    public boolean isShowIcebergsNumber() {
        return this.showIcebergsNumber;
    }

    public boolean isAggregateEC() {
        return this.aggregateEC;
    }

    public int getIcebergsSdInterval() {
        return this.icebergsSdInterval;
    }

    public double getIcebergsSdMultiplier() {
        return this.icebergsSdMultiplier;
    }

    public boolean isIcebergsAlertEnabled() {
        return this.icebergsAlertEnabled;
    }

    public String getIcebergsAlertTemplate() {
        return this.icebergsAlertTemplate;
    }

    public int getIcebergsAlertThreshold() {
        return this.icebergsAlertThreshold;
    }

    public boolean isIcebergsAlertAutoThreshold() {
        return this.icebergsAlertAutoThreshold;
    }

    public int getIcebergsAlertSdInterval() {
        return this.icebergsAlertSdInterval;
    }

    public double getIcebergsAlertSdMultiplier() {
        return this.icebergsAlertSdMultiplier;
    }

    public boolean isIcebergsShowHiddenIcons() {
        return this.icebergsShowHiddenIcons;
    }

    public int getIcebergsHiddenTransparency() {
        return this.icebergsHiddenTransparency;
    }

    public boolean isIcebergsNotAggregated() {
        return this.icebergsNotAggregated;
    }

    public Color getStopsAskColor() {
        return this.stopsAskColor;
    }

    public Color getStopsBidColor() {
        return this.stopsBidColor;
    }

    public Color getStopsHiddenAskColor() {
        return this.stopsHiddenAskColor;
    }

    public Color getStopsHiddenBidColor() {
        return this.stopsHiddenBidColor;
    }

    public int getStopsIconsHeight() {
        return this.stopsIconsHeight;
    }

    public int getStopsIconsOffset() {
        return this.stopsIconsOffset;
    }

    public int getStopsOrderLineWidth() {
        return this.stopsOrderLineWidth;
    }

    public int getStopsOffsetLineWidth() {
        return this.stopsOffsetLineWidth;
    }

    public int getStopsThreshold() {
        return this.stopsThreshold;
    }

    public int getStopsAggThreshold() {
        return this.stopsAggThreshold;
    }

    public int getStopsPriceAreaMultiplier() {
        return this.stopsPriceAreaMultiplier;
    }

    public int getStopsTimeAreaMultiplier() {
        return this.stopsTimeAreaMultiplier;
    }

    public boolean isShowStops() {
        return this.showStops;
    }

    public boolean isShowStopsTotals() {
        return this.showStopsTotals;
    }

    public boolean isShowStopsNumber() {
        return this.showStopsNumber;
    }

    public boolean isStopsAutoThreshold() {
        return this.stopsAutoThreshold;
    }

    public int getStopsSdInterval() {
        return this.stopsSdInterval;
    }

    public double getStopsSdMultiplier() {
        return this.stopsSdMultiplier;
    }

    public boolean isStopsAlertEnabled() {
        return this.stopsAlertEnabled;
    }

    public String getStopsAlertTemplate() {
        return this.stopsAlertTemplate;
    }

    public int getStopsAlertThreshold() {
        return this.stopsAlertThreshold;
    }

    public boolean isStopsAlertAutoThreshold() {
        return this.stopsAlertAutoThreshold;
    }

    public int getStopsAlertSdInterval() {
        return this.stopsAlertSdInterval;
    }

    public double getStopsAlertSdMultiplier() {
        return this.stopsAlertSdMultiplier;
    }

    public boolean isStopsShowHiddenIcons() {
        return this.stopsShowHiddenIcons;
    }

    public int getStopsHiddenTransparency() {
        return this.stopsHiddenTransparency;
    }

    public boolean isShowOnlyStopsTBPL() {
        return this.showOnlyStopsTBPL;
    }

    public boolean isShowOnlyStopsTBPLAlerts() {
        return this.showOnlyStopsTBPLAlerts;
    }

    public boolean isStopsNotAggregated() {
        return this.stopsNotAggregated;
    }

    public boolean isShowAggregationLines() {
        return this.showAggregationLines;
    }

    public Color getAggregationLineColor() {
        return this.aggregationLineColor;
    }

    public boolean isTelegramIsEnabledForIcebergs() {
        return this.telegramIsEnabledForIcebergs;
    }

    public boolean isTelegramIisEnabledForStops() {
        return this.telegramIisEnabledForStops;
    }

    public boolean isEnableBroadcasting() {
        return this.enableBroadcasting;
    }
}

