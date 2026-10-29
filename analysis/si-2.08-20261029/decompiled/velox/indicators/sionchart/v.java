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
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import javax.swing.UIManager;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterAdapter;
import velox.api.layer1.simplified.Api;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.a;
import velox.indicators.sionchart.b;
import velox.indicators.sionchart.b.i;
import velox.indicators.sionchart.b.n;
import velox.indicators.sionchart.c;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.e_0;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;

public class v
implements ScreenSpacePainterAdapter {
    private static final int o = 7;
    private final Api p;
    private final ScreenSpaceCanvas q;
    private final ScreenSpaceCanvas r;
    private final h s;
    public final HashMap<String, a> a = new HashMap();
    public final HashMap<String, a> b = new HashMap();
    public final List<b> c = new ArrayList<b>();
    private final e_0 t;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> u;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> v;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> w;
    private final Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> x;
    final e d;
    private final List<Long> y;
    int e;
    int f;
    int g;
    long h;
    long i;
    long j;
    int k;
    int l;
    int m;
    Font n;
    private int z;
    private final List<ScreenSpaceCanvas.CanvasIcon> A = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final List<ScreenSpaceCanvas.CanvasIcon> B = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> C = new HashMap();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> D = new HashMap();
    private final m E;

    public v(Api api, ScreenSpaceCanvasFactory screenSpaceCanvasFactory, h h2, e_0 e_02, List<Long> list, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map, Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map2, m m2) {
        this.p = api;
        this.q = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP);
        this.r = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.RIGHT_OF_TIMELINE);
        this.s = h2;
        this.t = e_02;
        this.u = map;
        this.v = map2;
        this.w = m2.q;
        this.x = m2.r;
        this.E = m2;
        this.d = m2.c();
        this.y = list;
        this.b();
        this.onMoveEnd();
    }

    public void onHeatmapFullPixelsWidth(int n2) {
        this.e = n2;
    }

    public void onHeatmapPixelsHeight(int n2) {
        this.f = n2;
        this.a();
    }

    public void onHeatmapPriceHeight(long l2) {
        this.m = (int)l2;
        this.a();
    }

    public void onHeatmapTimeLeft(long l2) {
        this.h = l2;
    }

    public void onHeatmapActiveTimeWidth(long l2) {
        this.i = l2;
    }

    public void onHeatmapFullTimeWidth(long l2) {
        this.j = l2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public synchronized void onMoveEnd() {
        Iterator<ScreenSpaceCanvas.CanvasIcon> iterator;
        for (ScreenSpaceCanvas.CanvasIcon object : this.A) {
            this.r.removeShape((ScreenSpaceCanvas.CanvasShape)object);
        }
        this.a.clear();
        this.b.clear();
        if (this.d.showIcebergs) {
            iterator = this.s.e;
            synchronized (iterator) {
                for (l l2 : this.s.e.values()) {
                    if (!l2.j && ((j)l2.k.get((int)(l2.k.size() - 1))).c < this.h && ((j)l2.k.get((int)0)).c > this.h + this.j) continue;
                    if (l2.f) {
                        this.a.put(l2.e, new a(l2));
                        continue;
                    }
                    this.b.put(l2.e, new a(l2));
                }
            }
        }
        this.A.clear();
        if (this.d.showIcebergs && this.d.showActive && this.g < this.e) {
            this.A.addAll(this.a(this.a));
            this.A.addAll(this.a(this.b));
            for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.A) {
                this.r.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.B) {
            this.q.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        this.B.clear();
        if (this.d.showIcebergs) {
            if (this.d.showDetection || this.d.showTrades || this.d.showExecution || this.d.showCancellation) {
                this.B.addAll(this.a(this.a, true));
                this.B.addAll(this.a(this.b, false));
            }
            this.B.addAll(this.a(this.a.values()));
            this.B.addAll(this.a(this.b.values()));
        }
        if (this.d.showStops) {
            this.c.clear();
            iterator = this.t.b;
            synchronized (iterator) {
                for (g_0 g_02 : this.t.b) {
                    if (g_02.a.get((int)0).c < this.h && g_02.a.get((int)(g_02.a.size() - 1)).c > this.h + this.j) continue;
                    this.c.add(new b(g_02));
                }
            }
            this.B.addAll(this.a(this.c));
        }
        if (this.d.showAggregationLines) {
            iterator = this.y;
            synchronized (iterator) {
                this.B.addAll(this.b(this.y));
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.B) {
            this.q.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        if (this.d.stopsAutoThreshold || this.d.stopsAlertAutoThreshold) {
            this.E.a(false);
        }
        if (this.d.icebergsAutoThreshold || this.d.icebergsAlertAutoThreshold) {
            this.E.b(false);
        }
    }

    public long a(int n2) {
        return this.j * (long)n2 / (long)this.e;
    }

    public void a() {
        if (this.f != 0 && this.m != 0) {
            this.k = this.m * this.d.icebergsIconsHeight / this.f + 1;
            this.l = this.m * this.d.stopsIconsHeight / this.f + 1;
        }
    }

    private ScreenSpaceCanvas.CanvasIcon a(c c2) {
        Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map = c2.d ? (c2.e ? this.w : this.u) : (c2.e ? this.x : this.v);
        ScreenSpaceCanvas.PreparedImage preparedImage = map.get((Object)OrderEventType.ACTIVE);
        preparedImage = this.a(preparedImage, c2.a(this.d), c2.d, c2.j == OrderEventType.STOP, c2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, 0, 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2, (double)c2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, bufferedImage.getWidth(), 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2, (double)c2.b);
        ScreenSpaceCanvas.CanvasIcon canvasIcon = new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate2);
        c2.a(canvasIcon);
        return canvasIcon;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(Map<String, a> map) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (a object : map.values()) {
            boolean bl;
            if (!object.b) continue;
            boolean bl2 = this.d.applyThresholdToActive && object.a() < this.d.icebergsThreshold;
            j j2 = new j(OrderEventType.ACTIVE, 0L, object.d, object.b(), (n)this.s.e.get(object.a));
            c c2 = new c(j2, object, object.c, bl2, true, this);
            arrayList2.add(c2);
            object.f.add(c2);
            if (this.d.icebergsNotAggregated) continue;
            block1: do {
                bl = false;
                for (c c3 : arrayList2) {
                    if (c2 == c3 || Math.abs(c2.b - c3.b) >= this.k) continue;
                    bl = true;
                    c3.a(c2);
                    arrayList2.remove(c2);
                    for (a a2 : c3.l) {
                        a2.f.remove(c2);
                        if (a2.f.contains(c3)) continue;
                        a2.f.add(c3);
                    }
                    c2 = c3;
                    continue block1;
                }
            } while (bl);
        }
        for (c c4 : arrayList2) {
            if (this.d.applyThresholdToActive && c4.a() < this.d.icebergsAggThreshold) {
                c4.e = true;
            }
            if (c4.e && !this.d.icebergsShowHiddenIcons) continue;
            arrayList.add(this.a(c4));
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(Collection<a> collection) {
        ArrayList<? extends ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        for (a a2 : collection) {
            boolean bl = true;
            if (a2.b && !this.d.applyThresholdToActive) {
                bl = false;
            } else if (a2.a() >= this.d.icebergsThreshold) {
                if (a2.a() >= this.d.icebergsAggThreshold) {
                    bl = false;
                } else if (!a2.f.isEmpty()) {
                    for (c c2 : a2.f) {
                        if (c2.e) continue;
                        bl = false;
                        break;
                    }
                }
            }
            if (bl) continue;
            arrayList.addAll(this.a(a2));
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(a a2) {
        ScreenSpaceCanvas.CanvasIcon canvasIcon;
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        j j2 = null;
        List<j> list = a2.e;
        synchronized (list) {
            for (j j3 : a2.e) {
                if (j2 != null) {
                    canvasIcon = this.a(j2.c, j2.d, j3.c, j2.d, a2.c ? this.d.icebergsBidColor : this.d.icebergsAskColor, 0, this.d.icebergsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if (j3.b == OrderEventType.MOVEMENT && (canvasIcon = this.a(j3.c, j2.d, j3.c, j3.d, a2.c ? this.d.icebergsBidColor : this.d.icebergsAskColor, 0, this.d.icebergsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                j2 = j3;
            }
        }
        if (a2.b && j2 != null && (canvasIcon = this.a(j2.c, j2.d, this.p.getProvider().getCurrentTime(), j2.d, a2.c ? this.d.icebergsBidColor : this.d.icebergsAskColor, 0, this.d.icebergsOrderLineWidth)) != null) {
            arrayList.add(canvasIcon);
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(b b2) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        j j2 = null;
        List<j> list = b2.a;
        synchronized (list) {
            for (j j3 : b2.a) {
                if (j2 != null) {
                    ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(j2.c, j2.d, j3.c, j2.d, b2.c ? this.d.stopsBidColor : this.d.stopsAskColor, 0, this.d.stopsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if ((canvasIcon = this.a(j3.c, j2.d, j3.c, j3.d, b2.c ? this.d.stopsBidColor : this.d.stopsAskColor, 0, this.d.stopsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                j2 = j3;
            }
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(Map<String, a> map, boolean bl) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.d.icebergsIconsOffset - this.d.icebergsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (a a2 : map.values()) {
            List<j> list = a2.e;
            synchronized (list) {
                for (j j2 : a2.e) {
                    boolean bl2;
                    if (j2.c < this.h || j2.c > this.h + this.i || !(j2.b == OrderEventType.DETECTION && this.d.showDetection || j2.b == OrderEventType.EXECUTION && this.d.showExecution || j2.b == OrderEventType.CANCELLATION && this.d.showCancellation) && (j2.b != OrderEventType.TRADE || !this.d.showTrades)) continue;
                    boolean bl3 = a2.a() < this.d.icebergsThreshold && (!a2.b || this.d.applyThresholdToActive);
                    c c2 = new c(j2, a2, bl, bl3, false, this);
                    arrayList2.add(c2);
                    a2.f.add(c2);
                    c2.a(bl ? this.u : this.v);
                    if (this.d.icebergsNotAggregated) continue;
                    block5: do {
                        bl2 = false;
                        for (c c3 : arrayList2) {
                            if (c2 == c3 || Math.abs(c2.a - c3.a) >= (c3.g + c2.g) / 2L * (long)this.d.icebergsTimeAreaMultiplier / 10L || Math.abs(c2.b - c3.b) >= this.k * this.d.icebergsPriceAreaMultiplier / 10) continue;
                            bl2 = true;
                            c3.a(c2);
                            arrayList2.remove(c2);
                            for (a a3 : c3.l) {
                                a3.f.remove(c2);
                                if (a3.f.contains(c3)) continue;
                                a3.f.add(c3);
                            }
                            c2 = c3;
                            c2.a(bl ? this.u : this.v);
                            continue block5;
                        }
                    } while (bl2);
                }
            }
        }
        this.a(arrayList, arrayList2, n2, this.d.icebergsAggThreshold, this.d.icebergsShowHiddenIcons);
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(List<b> list) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.d.stopsIconsOffset - this.d.stopsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<c> arrayList2 = new ArrayList<c>();
        for (b b2 : list) {
            boolean bl;
            j j2 = b2.a.get(b2.a.size() - 1);
            boolean bl2 = b2.e = b2.b < this.d.stopsThreshold || this.d.showOnlyStopsTBPL && !b2.a();
            if (j2.c < this.h || j2.c > this.h + this.i) continue;
            c c2 = new c(j2, null, b2.c, b2.e, false, this);
            c2.m.add(b2);
            arrayList2.add(c2);
            b2.d = c2;
            c2.a(c2.d ? this.u : this.v);
            if (this.d.stopsNotAggregated) continue;
            block1: do {
                bl = false;
                for (c c3 : arrayList2) {
                    if (b2.c != c3.d || c2 == c3 || c2.a - c3.a >= (c3.g + c2.g) / 2L * (long)this.d.stopsTimeAreaMultiplier / 10L || Math.abs(c2.b - c3.b) >= this.l * this.d.stopsPriceAreaMultiplier / 10) continue;
                    bl = true;
                    c3.a(c2);
                    arrayList2.remove(c2);
                    for (b b3 : c2.m) {
                        b3.d = c3;
                    }
                    c2 = c3;
                    c2.a(c2.d ? this.u : this.v);
                    continue block1;
                }
            } while (bl);
        }
        this.a(arrayList, arrayList2, n2, this.d.stopsAggThreshold, this.d.stopsShowHiddenIcons);
        for (b b2 : list) {
            if (b2.d != null) {
                if (!b2.e) {
                    b2.e = b2.d.e;
                }
                b2.d = null;
            } else if (b2.b < this.d.stopsAggThreshold) {
                b2.e = true;
            }
            if (b2.e) continue;
            arrayList.addAll(this.a(b2));
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> b(List<Long> list) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        for (Long l2 : list) {
            ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(l2, l2, this.d.aggregationLineColor, 1);
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
            ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(c2, n2);
            if (canvasIcon != null) {
                c2.i = canvasIcon;
                arrayList.add(canvasIcon);
            }
            c2.k = this.b(c2);
            arrayList.add(c2.k);
        }
    }

    private ScreenSpaceCanvas.CanvasIcon b(c c2) {
        if (c2.a < this.h || c2.a > this.h + this.i) {
            return null;
        }
        Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map = c2.d ? (c2.e ? this.w : this.u) : (c2.e ? this.x : this.v);
        ScreenSpaceCanvas.PreparedImage preparedImage = this.a(map.get((Object)c2.j), c2.a(this.d), c2.d, c2.j == OrderEventType.STOP, c2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        int n2 = c2.j == OrderEventType.STOP ? (c2.d ? this.d.stopsIconsOffset : -this.d.stopsIconsOffset) : (c2.d ? -this.d.icebergsIconsOffset : this.d.icebergsIconsOffset);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getWidth() / 2, c2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2 + n2, (double)c2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getWidth() / 2, c2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2 + n2, (double)c2.b);
        return new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate2);
    }

    private ScreenSpaceCanvas.PreparedImage a(ScreenSpaceCanvas.PreparedImage preparedImage, String string, boolean bl, boolean bl2, boolean bl3) {
        Object object;
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        Color color = bl2 ? (bl ? (bl3 ? this.d.getStopsHiddenBidColor() : this.d.stopsBidColor) : (bl3 ? this.d.getStopsHiddenAskColor() : this.d.stopsAskColor)) : (bl ? (bl3 ? this.d.getIcebergsHiddenBidColor() : this.d.icebergsBidColor) : (bl3 ? this.d.getIcebergsHiddenAskColor() : this.d.icebergsAskColor));
        int n2 = 0;
        if (!string.isEmpty()) {
            object = bufferedImage.createGraphics();
            ((Graphics)object).setFont(this.n);
            n2 = ((Graphics)object).getFontMetrics().stringWidth(string);
            ((Graphics)object).dispose();
        }
        object = new BufferedImage(bufferedImage.getWidth() + n2 + 7, bufferedImage.getHeight(), 2);
        Graphics2D graphics2D = ((BufferedImage)object).createGraphics();
        graphics2D.setColor(new Color(26, 34, 38, color.getAlpha()));
        int n3 = ((BufferedImage)object).getHeight() / 3;
        graphics2D.fillRoundRect(0, 0, ((BufferedImage)object).getWidth(), ((BufferedImage)object).getHeight(), n3, n3);
        graphics2D.drawImage((Image)bufferedImage.getSubimage(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight()), 0, 0, null);
        if (!string.isEmpty()) {
            graphics2D.setColor(new Color(255, 255, 255, color.getAlpha()));
            graphics2D.setFont(this.n);
            graphics2D.drawString(string, bufferedImage.getWidth() - 1, ((BufferedImage)object).getHeight() - graphics2D.getFontMetrics().getDescent() / 2);
        }
        graphics2D.dispose();
        int n4 = bl2 ? this.d.stopsIconsHeight : this.d.icebergsIconsHeight;
        int n5 = (int)((double)((BufferedImage)object).getWidth() / (double)((BufferedImage)object).getHeight() * (double)n4);
        BufferedImage bufferedImage2 = velox.indicators.sionchart.b.i.a((BufferedImage)object, n5, n4);
        return new ScreenSpaceCanvas.PreparedImage(bufferedImage2);
    }

    private ScreenSpaceCanvas.CanvasIcon a(long l2, int n2, long l3, int n3, Color color, int n4, int n5) {
        if ((l2 = Math.max(this.h, l2)) > (l3 = Math.min(this.h + this.i, l3))) {
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
        if ((l2 = Math.max(this.h, l2)) > (l3 = Math.min(this.h + this.i, l3))) {
            return null;
        }
        ScreenSpaceCanvas.PreparedImage preparedImage = this.a(color);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l2);
        ScreenSpaceCanvas.RelativeDataHorizontalCoordinate relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativeDataHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)ScreenSpaceCanvas.RelativeDataHorizontalCoordinate.HORIZONTAL_DATA_ZERO, l3);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativePixelVerticalCoordinate.VERTICAL_PIXEL_ZERO, 0);
        ScreenSpaceCanvas.RelativePixelVerticalCoordinate relativePixelVerticalCoordinate2 = new ScreenSpaceCanvas.RelativePixelVerticalCoordinate((ScreenSpaceCanvas.VerticalCoordinate)ScreenSpaceCanvas.RelativePixelVerticalCoordinate.VERTICAL_PIXEL_ZERO, this.f);
        int n3 = n2 / 2;
        int n4 = n2 % 2;
        relativeDataHorizontalCoordinate = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, -n3);
        relativeDataHorizontalCoordinate2 = new ScreenSpaceCanvas.RelativePixelHorizontalCoordinate((ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, n3 + n4);
        return new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)relativeDataHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)relativePixelVerticalCoordinate2);
    }

    private ScreenSpaceCanvas.CanvasIcon a(c c2, int n2) {
        return this.a(c2.a, c2.b, c2.a, c2.b, c2.j == OrderEventType.STOP ? (c2.d ? (c2.e ? this.d.getStopsHiddenBidColor() : this.d.stopsBidColor) : (c2.e ? this.d.getStopsHiddenAskColor() : this.d.stopsAskColor)) : (c2.d ? (c2.e ? this.d.getIcebergsHiddenBidColor() : this.d.icebergsBidColor) : (c2.e ? this.d.getIcebergsHiddenAskColor() : this.d.icebergsAskColor)), c2.j == OrderEventType.STOP ? (c2.d ? n2 : -n2) : (c2.d ? -n2 : n2), c2.j == OrderEventType.STOP ? this.d.stopsOffsetLineWidth : this.d.icebergsOffsetLineWidth);
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color) {
        ScreenSpaceCanvas.PreparedImage preparedImage = this.C.get(color);
        if (preparedImage == null) {
            if (this.C.size() == 7) {
                this.C.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(1, 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            graphics2D.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.C.put(color, preparedImage);
        }
        return preparedImage;
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color, int n2, int n3, int n4, int n5) {
        if (this.z != n5) {
            this.D.clear();
        }
        this.z = n5;
        ScreenSpaceCanvas.PreparedImage preparedImage = this.D.get(color);
        if (preparedImage == null) {
            if (this.D.size() == 7 || this.z != n5) {
                this.D.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(Math.abs(n4 - n2) + 1, Math.abs(n5 - n3) + 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            BasicStroke basicStroke = new BasicStroke(3.0f, 0, 2, 0.0f, new float[]{3.0f}, 0.0f);
            graphics2D.setStroke(basicStroke);
            graphics2D.drawLine(n2, n3, n4, Math.abs(n5));
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.D.put(color, preparedImage);
        }
        return preparedImage;
    }

    public void onRightOfTimelineWidth(int n2) {
        this.g = n2;
    }

    public void dispose() {
        this.q.dispose();
        this.r.dispose();
    }

    public void b() {
        int n2 = this.u.containsKey((Object)OrderEventType.TRADE) ? this.u.get((Object)OrderEventType.TRADE).getReadOnlyImage().getHeight() : 20;
        this.n = UIManager.getLookAndFeelDefaults().getFont("defaultFont").deriveFont((float)n2);
    }
}

