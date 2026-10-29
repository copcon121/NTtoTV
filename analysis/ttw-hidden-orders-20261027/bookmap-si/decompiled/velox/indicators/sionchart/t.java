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
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterAdapter;
import velox.api.layer1.simplified.Api;
import velox.indicators.sionchart.SitIndicator;
import velox.indicators.sionchart.a.i;
import velox.indicators.sionchart.b;
import velox.indicators.sionchart.b_0;
import velox.indicators.sionchart.c_0;
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;

class t
implements ScreenSpacePainterAdapter {
    private static final int l = 6;
    private final Api m;
    private final ScreenSpaceCanvas n;
    private final ScreenSpaceCanvas o;
    private final h p;
    private final b_0 q;
    private final Map<k, ScreenSpaceCanvas.PreparedImage> r;
    private final Map<k, ScreenSpaceCanvas.PreparedImage> s;
    private final Map<k, ScreenSpaceCanvas.PreparedImage> t;
    private final Map<k, ScreenSpaceCanvas.PreparedImage> u;
    final d a;
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
    private int v;
    private final List<ScreenSpaceCanvas.CanvasIcon> w = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final List<ScreenSpaceCanvas.CanvasIcon> x = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> y = new HashMap();
    private final HashMap<Color, ScreenSpaceCanvas.PreparedImage> z = new HashMap();
    private final SitIndicator A;

    public t(Api api, ScreenSpaceCanvasFactory screenSpaceCanvasFactory, h h2, b_0 b_02, Map<k, ScreenSpaceCanvas.PreparedImage> map, Map<k, ScreenSpaceCanvas.PreparedImage> map2, SitIndicator sitIndicator) {
        this.m = api;
        this.n = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.HEATMAP);
        this.o = screenSpaceCanvasFactory.createCanvas(ScreenSpaceCanvasFactory.ScreenSpaceCanvasType.RIGHT_OF_TIMELINE);
        this.p = h2;
        this.q = b_02;
        this.r = map;
        this.s = map2;
        this.t = sitIndicator.o;
        this.u = sitIndicator.p;
        this.A = sitIndicator;
        this.a = sitIndicator.c();
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
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.w) {
            this.o.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        this.w.clear();
        if (this.a.showIcebergs && this.a.showActive && this.d < this.b) {
            this.w.addAll(this.c());
            for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.w) {
                this.o.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.x) {
            this.n.removeShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        this.x.clear();
        if (this.a.showIcebergs) {
            if (this.a.showDetection || this.a.showTrades || this.a.showExecution || this.a.showCancellation) {
                object = this.p.e;
                synchronized (object) {
                    this.x.addAll(this.a(this.p.e, true));
                }
                object = this.p.d;
                synchronized (object) {
                    this.x.addAll(this.a(this.p.d, false));
                }
            }
            object = this.p.c;
            synchronized (object) {
                this.x.addAll(this.a(this.p.c.values()));
            }
        }
        if (this.a.showStops) {
            object = this.q.b;
            synchronized (object) {
                this.x.addAll(this.a(this.q.b));
            }
        }
        for (ScreenSpaceCanvas.CanvasIcon canvasIcon : this.x) {
            this.n.addShape((ScreenSpaceCanvas.CanvasShape)canvasIcon);
        }
        if (this.a.stopsAutoThreshold || this.a.stopsAlertAutoThreshold) {
            this.A.b(false);
        }
        if (this.a.icebergsAutoThreshold || this.a.icebergsAlertAutoThreshold) {
            this.A.c(false);
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

    private ScreenSpaceCanvas.CanvasIcon a(b b2) {
        Map<k, ScreenSpaceCanvas.PreparedImage> map = b2.d ? (b2.e ? this.t : this.r) : (b2.e ? this.u : this.s);
        ScreenSpaceCanvas.PreparedImage preparedImage = map.get((Object)velox.indicators.sionchart.k.ACTIVE);
        preparedImage = this.a(preparedImage, b2.a(this.a), b2.d, b2.j == velox.indicators.sionchart.k.STOP, b2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, 0, 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2, (double)b2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.PIXEL_ZERO, bufferedImage.getWidth(), 0L);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2, (double)b2.b);
        ScreenSpaceCanvas.CanvasIcon canvasIcon = new ScreenSpaceCanvas.CanvasIcon(preparedImage, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate, (ScreenSpaceCanvas.HorizontalCoordinate)compositeHorizontalCoordinate2, (ScreenSpaceCanvas.VerticalCoordinate)compositeVerticalCoordinate2);
        b2.a(canvasIcon);
        return canvasIcon;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> c() {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        ArrayList<b> arrayList2 = new ArrayList<b>();
        for (l object : this.p.c.values()) {
            boolean bl;
            if (!object.j) continue;
            boolean bl2 = this.a.applyThresholdToActive && object.a() < this.a.icebergsThreshold;
            j j2 = new j(velox.indicators.sionchart.k.ACTIVE, 0L, object.g, object.b(), object);
            b b2 = new b(j2, object.f, bl2, true, this);
            arrayList2.add(b2);
            object.d.add(b2);
            if (this.a.icebergsNotAggregated) continue;
            block1: do {
                bl = false;
                for (b b3 : arrayList2) {
                    if (b2 == b3 || b2.d != b3.d || Math.abs(b2.b - b3.b) >= this.h) continue;
                    bl = true;
                    b3.a(b2);
                    arrayList2.remove(b2);
                    for (l l2 : b3.l) {
                        l2.d.remove(b2);
                        if (l2.d.contains(b3)) continue;
                        l2.d.add(b3);
                    }
                    b2 = b3;
                    continue block1;
                }
            } while (bl);
        }
        for (b b4 : arrayList2) {
            if (this.a.applyThresholdToActive && b4.a() < this.a.icebergsAggThreshold) {
                b4.e = true;
            }
            arrayList.add(this.a(b4));
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(Collection<l> collection) {
        ArrayList<? extends ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        for (l l2 : collection) {
            if (l2.a() < this.a.icebergsThreshold && (!l2.j || this.a.applyThresholdToActive)) continue;
            boolean bl = false;
            if (!l2.d.isEmpty()) {
                bl = true;
                for (b b2 : l2.d) {
                    if (l2.j) {
                        if (!b2.f || b2.e) continue;
                        bl = false;
                        break;
                    }
                    if (b2.e) continue;
                    bl = false;
                    break;
                }
                l2.d.clear();
            } else if (l2.a() < this.a.icebergsAggThreshold) {
                bl = true;
            }
            if (bl) continue;
            arrayList.addAll(this.a(l2));
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(l l2) {
        ScreenSpaceCanvas.CanvasIcon canvasIcon;
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        j j2 = null;
        List list = l2.k;
        synchronized (list) {
            for (j j3 : l2.k) {
                if (j2 != null) {
                    canvasIcon = this.a(j2.c, j2.d, j3.c, j2.d, l2.f ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if (j3.b == velox.indicators.sionchart.k.MOVED && (canvasIcon = this.a(j3.c, j2.d, j3.c, j3.d, l2.f ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                j2 = j3;
            }
        }
        if (l2.j && j2 != null && (canvasIcon = this.a(j2.c, j2.d, this.m.getProvider().getCurrentTime(), j2.d, l2.f ? this.a.icebergsBidColor : this.a.icebergsAskColor, 0, this.a.icebergsOrderLineWidth)) != null) {
            arrayList.add(canvasIcon);
        }
        return arrayList;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(c_0 c_02) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        j j2 = null;
        List<j> list = c_02.a;
        synchronized (list) {
            for (j j3 : c_02.a) {
                if (j2 != null) {
                    ScreenSpaceCanvas.CanvasIcon canvasIcon = this.a(j2.c, j2.d, j3.c, j2.d, c_02.c ? this.a.stopsBidColor : this.a.stopsAskColor, 0, this.a.stopsOrderLineWidth);
                    if (canvasIcon != null) {
                        arrayList.add(canvasIcon);
                    }
                    if ((canvasIcon = this.a(j3.c, j2.d, j3.c, j3.d, c_02.c ? this.a.stopsBidColor : this.a.stopsAskColor, 0, this.a.stopsOrderLineWidth)) != null) {
                        arrayList.add(canvasIcon);
                    }
                }
                j2 = j3;
            }
        }
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(List<j> list, boolean bl) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.a.icebergsIconsOffset - this.a.icebergsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<b> arrayList2 = new ArrayList<b>();
        for (j j2 : list) {
            boolean bl2;
            if (j2.c < this.e || j2.c > this.e + this.f || !(j2.b == velox.indicators.sionchart.k.DETECTED && this.a.showDetection || j2.b == velox.indicators.sionchart.k.EXECUTED && this.a.showExecution || j2.b == velox.indicators.sionchart.k.CANCELED && this.a.showCancellation) && (j2.b != velox.indicators.sionchart.k.TRADE || !this.a.showTrades)) continue;
            boolean bl3 = j2.a.a() < this.a.icebergsThreshold && (!j2.a.j || this.a.applyThresholdToActive);
            b b2 = new b(j2, bl, bl3, false, this);
            arrayList2.add(b2);
            j2.a.d.add(b2);
            b2.a(bl ? this.r : this.s);
            if (this.a.icebergsNotAggregated) continue;
            block1: do {
                bl2 = false;
                for (b b3 : arrayList2) {
                    if (b2 == b3 || b2.a - b3.a >= (b3.g + b2.g) / 2L * (long)this.a.icebergsTimeAreaMultiplier / 10L || Math.abs(b2.b - b3.b) >= this.h * this.a.icebergsPriceAreaMultiplier / 10) continue;
                    bl2 = true;
                    b3.a(b2);
                    arrayList2.remove(b2);
                    for (l l2 : b3.l) {
                        l2.d.remove(b2);
                        if (l2.d.contains(b3)) continue;
                        l2.d.add(b3);
                    }
                    b2 = b3;
                    b2.a(bl ? this.r : this.s);
                    continue block1;
                }
            } while (bl2);
        }
        this.a(arrayList, arrayList2, n2, this.a.icebergsAggThreshold, this.a.icebergsShowHiddenIcons);
        return arrayList;
    }

    private Collection<? extends ScreenSpaceCanvas.CanvasIcon> a(List<c_0> list) {
        ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList = new ArrayList<ScreenSpaceCanvas.CanvasIcon>();
        int n2 = this.a.stopsIconsOffset - this.a.stopsIconsHeight / 2;
        if (n2 < 0) {
            n2 = 0;
        }
        ArrayList<b> arrayList2 = new ArrayList<b>();
        for (c_0 c_02 : list) {
            boolean bl;
            j j2 = c_02.a.get(c_02.a.size() - 1);
            boolean bl2 = c_02.d = c_02.b < this.a.stopsThreshold || this.a.showOnlyStopsTBPL && !c_02.c();
            if (j2.c < this.e || j2.c > this.e + this.f) continue;
            b b2 = new b(j2, c_02.c, c_02.d, false, this);
            b2.m.add(c_02);
            arrayList2.add(b2);
            c_02.e = b2;
            b2.a(b2.d ? this.r : this.s);
            if (this.a.stopsNotAggregated) continue;
            block1: do {
                bl = false;
                for (b b3 : arrayList2) {
                    if (c_02.c != b3.d || b2 == b3 || b2.a - b3.a >= (b3.g + b2.g) / 2L * (long)this.a.stopsTimeAreaMultiplier / 10L || Math.abs(b2.b - b3.b) >= this.i * this.a.stopsPriceAreaMultiplier / 10) continue;
                    bl = true;
                    b3.a(b2);
                    arrayList2.remove(b2);
                    for (c_0 c_03 : b2.m) {
                        c_03.e = b3;
                    }
                    b2 = b3;
                    b2.a(b2.d ? this.r : this.s);
                    continue block1;
                }
            } while (bl);
        }
        this.a(arrayList, arrayList2, n2, this.a.stopsAggThreshold, this.a.stopsShowHiddenIcons);
        for (c_0 c_02 : list) {
            if (c_02.e != null) {
                c_02.d = c_02.e.e;
                c_02.e = null;
            } else if (c_02.b < this.a.stopsAggThreshold) {
                c_02.d = true;
            }
            if (c_02.d) continue;
            arrayList.addAll(this.a(c_02));
        }
        return arrayList;
    }

    private void a(ArrayList<ScreenSpaceCanvas.CanvasIcon> arrayList, List<b> list, int n2, int n3, boolean bl) {
        for (b b2 : list) {
            int n4;
            if (!b2.e && n3 > 0 && (0 < (n4 = b2.a()) && n4 < n3 || n4 == 0 && b2.c < n3)) {
                b2.e = true;
            }
            if (b2.e && !bl) continue;
            b2.i = this.a(b2, n2);
            arrayList.add(b2.i);
            b2.k = this.b(b2);
            arrayList.add(b2.k);
        }
    }

    private ScreenSpaceCanvas.CanvasIcon b(b b2) {
        if (b2.a < this.e || b2.a > this.e + this.f) {
            return null;
        }
        Map<k, ScreenSpaceCanvas.PreparedImage> map = b2.d ? (b2.e ? this.t : this.r) : (b2.e ? this.u : this.s);
        ScreenSpaceCanvas.PreparedImage preparedImage = this.a(map.get((Object)b2.j), b2.a(this.a), b2.d, b2.j == velox.indicators.sionchart.k.STOP, b2.e);
        BufferedImage bufferedImage = preparedImage.getReadOnlyImage();
        int n2 = b2.j == velox.indicators.sionchart.k.STOP ? (b2.d ? this.a.stopsIconsOffset : -this.a.stopsIconsOffset) : (b2.d ? -this.a.icebergsIconsOffset : this.a.icebergsIconsOffset);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getWidth() / 2, b2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, -bufferedImage.getHeight() / 2 + n2, (double)b2.b);
        ScreenSpaceCanvas.CompositeHorizontalCoordinate compositeHorizontalCoordinate2 = new ScreenSpaceCanvas.CompositeHorizontalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getWidth() / 2, b2.a);
        ScreenSpaceCanvas.CompositeVerticalCoordinate compositeVerticalCoordinate2 = new ScreenSpaceCanvas.CompositeVerticalCoordinate(ScreenSpaceCanvas.CompositeCoordinateBase.DATA_ZERO, bufferedImage.getHeight() / 2 + n2, (double)b2.b);
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

    private ScreenSpaceCanvas.CanvasIcon a(b b2, int n2) {
        return this.a(b2.a, b2.b, b2.a, b2.b, b2.j == velox.indicators.sionchart.k.STOP ? (b2.d ? (b2.e ? this.a.getStopsHiddenBidColor() : this.a.stopsBidColor) : (b2.e ? this.a.getStopsHiddenAskColor() : this.a.stopsAskColor)) : (b2.d ? (b2.e ? this.a.getIcebergsHiddenBidColor() : this.a.icebergsBidColor) : (b2.e ? this.a.getIcebergsHiddenAskColor() : this.a.icebergsAskColor)), b2.j == velox.indicators.sionchart.k.STOP ? (b2.d ? n2 : -n2) : (b2.d ? -n2 : n2), b2.j == velox.indicators.sionchart.k.STOP ? this.a.stopsOffsetLineWidth : this.a.icebergsOffsetLineWidth);
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color) {
        ScreenSpaceCanvas.PreparedImage preparedImage = this.y.get(color);
        if (preparedImage == null) {
            if (this.y.size() == 6) {
                this.y.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(1, 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            graphics2D.fillRect(0, 0, bufferedImage.getWidth(), bufferedImage.getHeight());
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.y.put(color, preparedImage);
        }
        return preparedImage;
    }

    private ScreenSpaceCanvas.PreparedImage a(Color color, int n2, int n3, int n4, int n5) {
        if (this.v != n5) {
            this.z.clear();
        }
        this.v = n5;
        ScreenSpaceCanvas.PreparedImage preparedImage = this.z.get(color);
        if (preparedImage == null) {
            if (this.z.size() == 6 || this.v != n5) {
                this.z.clear();
            }
            BufferedImage bufferedImage = new BufferedImage(Math.abs(n4 - n2) + 1, Math.abs(n5 - n3) + 1, 2);
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setColor(color);
            BasicStroke basicStroke = new BasicStroke(3.0f, 0, 2, 0.0f, new float[]{3.0f}, 0.0f);
            graphics2D.setStroke(basicStroke);
            graphics2D.drawLine(n2, n3, n4, Math.abs(n5));
            graphics2D.dispose();
            preparedImage = new ScreenSpaceCanvas.PreparedImage(bufferedImage);
            this.z.put(color, preparedImage);
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
        int n2 = this.r.containsKey((Object)velox.indicators.sionchart.k.TRADE) ? this.r.get((Object)velox.indicators.sionchart.k.TRADE).getReadOnlyImage().getHeight() : 20;
        this.k = new Font("Roboto", 0, n2);
    }
}

