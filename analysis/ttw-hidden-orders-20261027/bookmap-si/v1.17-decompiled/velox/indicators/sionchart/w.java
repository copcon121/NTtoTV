/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasShape
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CompositeCoordinateBase
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CompositeHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CompositeVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$HorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativeDataVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelHorizontalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$RelativePixelVerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$VerticalCoordinate
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory$ScreenSpaceCanvasType
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterAdapter
 *  velox.api.layer1.simplified.Api
 */
package velox.indicators.sionchart;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.swing.UIManager;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterAdapter;
import velox.api.layer1.simplified.Api;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.i;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;

class w
implements ScreenSpacePainterAdapter {
    private static final int l = 7;
    private final Api m;
    private final ScreenSpaceCanvas n;
    private final ScreenSpaceCanvas o;
    private final velox.indicators.sionchart.i p;
    private final e_0 q;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> r;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> s;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> t;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> u;
    final e a;
    private final List<Long> v;
    int b;
    int c;
    int d;
    long e;
    long f;
    long g;
    int h;
    int i;
    int j;
    Font k;
    private int w;
    private final List<ScreenSpaceCanvas.CanvasIcon> x = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final List<ScreenSpaceCanvas.CanvasIcon> y = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> z = new HashMap();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> A = new HashMap();
    private final SitIndicator B;

    public w(Api api, ScreenSpaceCanvasFactory screenSpaceCanvasFactory, velox.indicators.sionchart.i i2, e_0 e_02, List<Long> list, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map2, SitIndicator sitIndicator) {
        this.m = api;
        this.n = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP);
        this.o = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.RIGHT_OF_TIMELINE);
        this.p = i2;
        this.q = e_02;
        this.r = map;
        this.s = map2;
        this.t = sitIndicator.r;
        this.u = sitIndicator.s;
        this.B = sitIndicator;
        this.a = sitIndicator.e();
        this.v = list;
        this.b();
        this.onMoveEnd();
    }

    public void onHeatmapFullPixelsWidth(int n2) {
        this.b = n2;
    }

    public void onHeatmapPixelsHeight(int n2) {
        this.c = n2;
        this.a();
    }

    public void onHeatmapPriceHeight(long l2) {
        this.j = (int)l2;
        this.a();
    }

    public void onHeatmapTimeLeft(long l2) {
        this.e = l2;
    }

    public void onHeatmapActiveTimeWidth(long l2) {
        this.f = l2;
    }

    public void onHeatmapFullTimeWidth(long l2) {
        this.g = l2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public synchronized void onMoveEnd() {
        Object object;
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.x) {
            this.o.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        this.x.clear();
        if (this.a.showIcebergs && this.a.showActive && this.d < this.b) {
            this.x.addAll(this.c());
            for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.x) {
                this.o.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.y) {
            this.n.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        this.y.clear();
        if (this.a.showIcebergs) {
            if (this.a.showDetection || this.a.showTrades || this.a.showExecution || this.a.showCancellation) {
                object = this.p.e;
                synchronized (object) {
                    this.y.addAll(this.a(this.p.e, true));
                }
                object = this.p.d;
                synchronized (object) {
                    this.y.addAll(this.a(this.p.d, false));
                }
            }
            object = this.p.c;
            synchronized (object) {
                this.y.addAll(this.a(this.p.c.values()));
            }
        }
        if (this.a.showStops) {
            object = this.q.b;
            synchronized (object) {
                this.y.addAll(this.a(this.q.b));
            }
        }
        if (this.a.showAggregationLines) {
            object = this.v;
            synchronized (object) {
                this.y.addAll(this.b(this.v));
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.y) {
            this.n.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        if (this.a.stopsAutoThreshold || this.a.stopsAlertAutoThreshold) {
            this.B.a(false);
        }
        if (this.a.icebergsAutoThreshold || this.a.icebergsAlertAutoThreshold) {
            this.B.b(false);
        }
    }

    public long a(int n2) {
        return this.g * (long)n2 / (long)this.b;
    }

    public void a() {
        if (this.c != 0 && this.j != 0) {
            this.h = this.j * this.a.icebergsIconsHeight / this.c + 1;
            this.i = this.j * this.a.stopsIconsHeight / this.c + 1;
        }
    }

    private ScreenSpaceCanvas.CanvasIcon a(c c2) {
        Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map = c2.d ? (c2.e ? this.t : this.r) : (c2.e ? this.u : this.s);
        ScreenSpaceCanvas.PreparedImage preparedImage = map.get((Object)OrderEventType.ACTIVE);
        preparedImage = this.a(preparedImage, c2.a(this.a), c2.d, c2.j == OrderEventType.STOP, c2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, 0, 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2, (double)c2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, bufferedImage.getWidth(), 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2, (double)c2.b);
        ScreenSpaceCanvas.CanvasIcon canvasIcon = new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate2);
        c2.a(canvasIcon);
        return canvasIcon;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> c() {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (l object : this.p.c.values()) {
            boolean bl;
            if (!object.k) continue;
            boolean bl2 = this.a.applyThresholdToActive && object.a() < this.a.icebergsThreshold;
            k k2 = new k(OrderEventType.ACTIVE, 0L, object.h, object.b(), object);
            c c2 = new c(k2, object.g, bl2, true, this);
            arrayList2.add(c2);
            object.d.add(c2);
            if (this.a.icebergsNotAggregated) continue;
            block1: do {
                bl = false;
                for (c c3 : arrayList2) {
                    if (c2 == c3 || c2.d != c3.d || Math.abs(c2.b - c3.b) >= this.h) continue;
                    bl = true;
                    c3.a(c2);
                    arrayList2.remove(c2);
                    for (l l2 : c3.l) {
                        l2.d.remove(c2);
                        if (l2.d.contains(c3)) continue;
                        l2.d.add(c3);
                    }
                    c2 = c3;
                    continue block1;
                }
            } while (bl);
        }
        for (c c4 : arrayList2) {
            if (this.a.applyThresholdToActive && c4.a() < this.a.icebergsAggThreshold) {
                c4.e = true;
            }
            if (c4.e && !this.a.icebergsShowHiddenIcons) continue;
            arrayList.add(this.a(c4));
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(Collection<l> collection) {
        ArrayList<? extends ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        for (l l2 : collection) {
            boolean bl = true;
            if (l2.k && !this.a.applyThresholdToActive) {
                bl = false;
            } else if (l2.a() >= this.a.icebergsThreshold) {
                if (l2.a() >= this.a.icebergsAggThreshold) {
                    bl = false;
                } else if (!l2.d.isEmpty()) {
                    for (c c2 : l2.d) {
                        if (c2.e) continue;
                        bl = false;
                        break;
                    }
                }
            }
            if (!bl) {
                arrayList.addAll(this.a(l2));
            }
            if (l2.d.isEmpty()) continue;
            l2.d.clear();
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(l l2) {
        ScreenSpaceCanvas.CanvasIcon canvasIcon;
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        k k2 = null;
        List list = l2.l;
        synchronized (list) {
            for (k k3 : l2.l) {
                if (k2 != null) {
                    canvasIcon = this.a(k2.c, k2.d, k3.c, k2.d, l2.g ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if (k3.b == OrderEventType.MOVEMENT && (canvasIcon = this.a(k3.c, k2.d, k3.c, k3.d, l2.g ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                k2 = k3;
            }
        }
        if (l2.k && k2 != null && (canvasIcon = this.a(k2.c, k2.d, this.m.getProvider().getCurrentTime(), k2.d, l2.g ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth)) != null) {
            arrayList.add(canvasIcon);
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(g_0 g_02) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        k k2 = null;
        List<k> list = g_02.a;
        synchronized (list) {
            for (k k3 : g_02.a) {
                if (k2 != null) {
                    ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(k2.c, k2.d, k3.c, k2.d, g_02.c ? this.a.stopsBidColor : this.a.stopsAskColor, 0, this.a.stopsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if ((canvasIcon = this.a(k3.c, k2.d, k3.c, k3.d, g_02.c ? this.a.stopsBidColor : this.a.stopsAskColor, 0, this.a.stopsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                k2 = k3;
            }
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(List<k> list, boolean bl) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.a.icebergsIconsOffset - this.a.icebergsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (k k2 : list) {
            boolean bl2;
            if (k2.c < this.e || k2.c > this.e + this.f || !(k2.b == OrderEventType.DETECTION && this.a.showDetection || k2.b == OrderEventType.EXECUTION && this.a.showExecution || k2.b == OrderEventType.CANCELLATION && this.a.showCancellation) && (k2.b != OrderEventType.TRADE || !this.a.showTrades)) continue;
            boolean bl3 = k2.a.a() < this.a.icebergsThreshold && (!k2.a.k || this.a.applyThresholdToActive);
            c c2 = new c(k2, bl, bl3, false, this);
            arrayList2.add(c2);
            k2.a.d.add(c2);
            c2.a(bl ? this.r : this.s);
            if (this.a.icebergsNotAggregated) continue;
            block1: do {
                bl2 = false;
                for (c c3 : arrayList2) {
                    if (c2 == c3 || c2.a - c3.a >= (c3.g + c2.g) / 2L * (long)this.a.icebergsTimeAreaMultiplier / 10L || Math.abs(c2.b - c3.b) >= this.h * this.a.icebergsPriceAreaMultiplier / 10) continue;
                    bl2 = true;
                    c3.a(c2);
                    arrayList2.remove(c2);
                    for (l l2 : c3.l) {
                        l2.d.remove(c2);
                        if (l2.d.contains(c3)) continue;
                        l2.d.add(c3);
                    }
                    c2 = c3;
                    c2.a(bl ? this.r : this.s);
                    continue block1;
                }
            } while (bl2);
        }
        this.a(arrayList, arrayList2, n2, this.a.icebergsAggThreshold, this.a.icebergsShowHiddenIcons);
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(List<g_0> list) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.a.stopsIconsOffset - this.a.stopsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (g_0 g_02 : list) {
            boolean bl;
            k k2 = g_02.a.get(g_02.a.size() - 1);
            boolean bl2 = g_02.d = g_02.b < this.a.stopsThreshold || this.a.showOnlyStopsTBPL && !g_02.c();
            if (k2.c < this.e || k2.c > this.e + this.f) continue;
            c c2 = new c(k2, g_02.c, g_02.d, false, this);
            c2.m.add(g_02);
            arrayList2.add(c2);
            g_02.e = c2;
            c2.a(c2.d ? this.r : this.s);
            if (this.a.stopsNotAggregated) continue;
            block1: do {
                bl = false;
                for (c c3 : arrayList2) {
                    if (g_02.c != c3.d || c2 == c3 || c2.a - c3.a >= (c3.g + c2.g) / 2L * (long)this.a.stopsTimeAreaMultiplier / 10L || Math.abs(c2.b - c3.b) >= this.i * this.a.stopsPriceAreaMultiplier / 10) continue;
                    bl = true;
                    c3.a(c2);
                    arrayList2.remove(c2);
                    for (g_0 g_03 : c2.m) {
                        g_03.e = c3;
                    }
                    c2 = c3;
                    c2.a(c2.d ? this.r : this.s);
                    continue block1;
                }
            } while (bl);
        }
        this.a(arrayList, arrayList2, n2, this.a.stopsAggThreshold, this.a.stopsShowHiddenIcons);
        for (g_0 g_02 : list) {
            if (g_02.e != null) {
                if (!g_02.d) {
                    g_02.d = g_02.e.e;
                }
                g_02.e = null;
            } else if (g_02.b < this.a.stopsAggThreshold) {
                g_02.d = true;
            }
            if (g_02.d) continue;
            arrayList.addAll(this.a(g_02));
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> b(List<Long> list) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        for (Long l2 : list) {
            ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(l2, l2, this.a.aggregationLineColor, 1);
            if (canvasIcon == null) continue;
            arrayList.add(canvasIcon);
        }
        return arrayList;
    }

    private void a(ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList, List<c> list, int n2, int n3, boolean bl) {
        for (c c2 : list) {
            int n4;
            if (!c2.e && n3 > 0 && (0 < (n4 = c2.a()) && n4 < n3 || n4 == 0 && c2.c < n3)) {
                c2.e = true;
            }
            if (c2.e && !bl) continue;
            c2.i = this.a(c2, n2);
            arrayList.add(c2.i);
            c2.k = this.b(c2);
            arrayList.add(c2.k);
        }
    }

    private ScreenSpaceCanvas.CanvasIcon b(c c2) {
        if (c2.a < this.e || c2.a > this.e + this.f) {
            return null;
        }
        Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map = c2.d ? (c2.e ? this.t : this.r) : (c2.e ? this.u : this.s);
        ScreenSpaceCanvas.PreparedImage preparedImage = this.a(map.get((Object)c2.j), c2.a(this.a), c2.d, c2.j == OrderEventType.STOP, c2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        int n2 = c2.j == OrderEventType.STOP ? (c2.d ? this.a.stopsIconsOffset : -this.a.stopsIconsOffset) : (c2.d ? -this.a.icebergsIconsOffset : this.a.icebergsIconsOffset);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getWidth() / 2, c2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2 + n2, (double)c2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getWidth() / 2, c2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2 + n2, (double)c2.b);
        return new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate2);
    }

    private ScreenSpaceCanvas.PreparedImage a(ScreenSpaceCanvas.PreparedImage preparedImage, String string, boolean bl, boolean bl2, boolean bl3) {
        Object object;
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        Color color = bl2 ? (bl ? (bl3 ? this.a.getStopsHiddenBidColor() : this.a.stopsBidColor) : (bl3 ? this.a.getStopsHiddenAskColor() : this.a.stopsAskColor)) : (bl ? (bl3 ? this.a.getIcebergsHiddenBidColor() : this.a.icebergsBidColor) : (bl3 ? this.a.getIcebergsHiddenAskColor() : this.a.icebergsAskColor));
        int n2 = 0;
        if (string.length() > 0) {
            object = bufferedImage.createGraphics();
            ((Graphics)object).setFont(this.k);
            n2 = ((Graphics)object).getFontMetrics().stringWidth(string);
            ((Graphics)object).dispose();
        }
        object = new BufferedImage(bufferedImage.getWidth() + n2 + 7, bufferedImage.getHeight(), 2);
        Graphics2D graphics2D = ((BufferedImage)object).createGraphics();
        graphics2D.setColor(new Color(26, 34, 38, color.getAlpha()));
        int n3 = ((BufferedImage)object).getHeight() / 3;
        graphics2D.fillRoundRect(0, 0, ((BufferedImage)object).getWidth(), ((BufferedImage)object).getHeight(), n3, n3);
        graphics2D.drawImage((Image)bufferedImage.getSubimage(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight()), 0, 0, null);
        if (string.length() > 0) {
            graphics2D.setColor(new Color(255, 255, 255, color.getAlpha()));
            graphics2D.setFont(this.k);
            graphics2D.drawString(string, bufferedImage.getWidth() - 1, ((BufferedImage)object).getHeight() - graphics2D.getFontMetrics().getDescent() / 2);
        }
        graphics2D.dispose();
        int n4 = bl2 ? this.a.stopsIconsHeight : this.a.icebergsIconsHeight;
        int n5 = (int)((double)((BufferedImage)object).getWidth() / (double)((BufferedImage)object).getHeight() * (double)n4);
        BufferedImage bufferedImage2 = velox.indicators.sionchart.a.i.a((BufferedImage)object, n5, n4);
        return new ScreenSpaceCanvas.PreparedImage(bufferedImage2);
    }

    private ScreenSpaceCanvas.CanvasIcon a(long l2, int n2, long l3, int n3, Color color, int n4, int n5) {
        if ((l2 = Math.max(this.e, l2)) > (l3 = Math.min(this.e + this.f, l3))) {
            return null;
        }
        ScreenSpaceCanvas.PreparedImage preparedImage = n4 == 0 ? this.a(color) : this.a(color, 0, 0, 0, n4);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l2);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l3);
        ScreenSpaceCanvas.RelativeDataVerticalCoordinate relativeDataVerticalCoordinate = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeDataVerticalCoordinate.VERTICAL_DATA_ZERO, (double)n2);
        ScreenSpaceCanvas.RelativeDataVerticalCoordinate relativeDataVerticalCoordinate2 = new ScreenSpaceCanvas.RelativeDataVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativeDataVerticalCoordinate.VERTICAL_DATA_ZERO, (double)n3);
        int n6 = 0;
        int n7 = 0;
        int n8 = 0;
        int n9 = 0;
        if (l2 == l3) {
            n6 = n5 / 2;
            n7 = n5 % 2;
        } else if (n2 == n3) {
            n8 = n5 / 2;
            n9 = n5 % 2;
        }
        relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, -n6);
        relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, n6 + n7);
        relativeDataVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)relativeDataVerticalCoordinate, -n8);
        relativeDataVerticalCoordinate2 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)relativeDataVerticalCoordinate2, n8 + n9 + n4);
        return new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativeDataVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativeDataVerticalCoordinate2);
    }

    private ScreenSpaceCanvas.CanvasIcon a(long l2, long l3, Color color, int n2) {
        if ((l2 = Math.max(this.e, l2)) > (l3 = Math.min(this.e + this.f, l3))) {
            return null;
        }
        ScreenSpaceCanvas.PreparedImage preparedImage = this.a(color);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l2);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l3);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativePixelVerticalCoordinate.VERTICAL_PIXEL_ZERO, 0);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate2 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativePixelVerticalCoordinate.VERTICAL_PIXEL_ZERO, this.c);
        int n3 = n2 / 2;
        int n4 = n2 % 2;
        relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, -n3);
        relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, n3 + n4);
        return new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate2);
    }

    private ScreenSpaceCanvas.CanvasIcon a(c c2, int n2) {
        return this.a(c2.a, c2.b, c2.a, c2.b, c2.j == OrderEventType.STOP ? (c2.d ? (c2.e ? this.a.getStopsHiddenBidColor() : this.a.stopsBidColor) : (c2.e ? this.a.getStopsHiddenAskColor() : this.a.stopsAskColor)) : (c2.d ? (c2.e ? this.a.getIcebergsHiddenBidColor() : this.a.icebergsBidColor) : (c2.e ? this.a.getIcebergsHiddenAskColor() : this.a.icebergsAskColor)), c2.j == OrderEventType.STOP ? (c2.d ? n2 : -n2) : (c2.d ? -n2 : n2), c2.j == OrderEventType.STOP ? this.a.stopsOffsetLineWidth : this.a.icebergsOffsetLineWidth);
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color) {
        ScreenSpaceCanvas.PreparedImage preparedImage = this.z.get(color);
        if (preparedImage == null) {
            if (this.z.size() == 7) {
                this.z.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(1, 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            graphics2D.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.z.put(color, preparedImage);
        }
        return preparedImage;
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color, int n2, int n3, int n4, int n5) {
        if (this.w != n5) {
            this.A.clear();
        }
        this.w = n5;
        ScreenSpaceCanvas.PreparedImage preparedImage = this.A.get(color);
        if (preparedImage == null) {
            if (this.A.size() == 7 || this.w != n5) {
                this.A.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(Math.abs(n4 - n2) + 1, Math.abs(n5 - n3) + 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            BasicStroke basicStroke = new BasicStroke(3.0f, 0, 2, 0.0f, new float[]{3.0f}, 0.0f);
            graphics2D.setStroke(basicStroke);
            graphics2D.drawLine(n2, n3, n4, Math.abs(n5));
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.A.put(color, preparedImage);
        }
        return preparedImage;
    }

    public void onRightOfTimelineWidth(int n2) {
        this.d = n2;
    }

    public void dispose() {
        this.n.dispose();
        this.o.dispose();
    }

    public void b() {
        int n2 = this.r.containsKey((Object)OrderEventType.TRADE) ? this.r.get((Object)OrderEventType.TRADE).getReadOnlyImage().getHeight() : 20;
        this.k = UIManager.getLookAndFeelDefaults().getFont("defaultFont").deriveFont((float)n2);
    }
}

