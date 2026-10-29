/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$CanvasIcon
 *  velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas$PreparedImage
 */
package velox.indicators.sionchart;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.indicators.sionchart.OrderEventType;
import velox.indicators.sionchart.a.t;
import velox.indicators.sionchart.e;
import velox.indicators.sionchart.g_0;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.w;

public class c {
    public long a;
    public int b;
    public int c;
    public final boolean d;
    public boolean e;
    public boolean f;
    public long g;
    public HashSet<OrderEventType> h = new HashSet();
    public ScreenSpaceCanvas.CanvasIcon i;
    public OrderEventType j;
    public ScreenSpaceCanvas.CanvasIcon k;
    private final w n;
    private HashMap<OrderEventType, Integer> o = new HashMap();
    public HashSet<l> l = new HashSet();
    public LinkedList<g_0> m = new LinkedList();

    public c(k k2, boolean bl, boolean bl2, boolean bl3, w w2) {
        this.a = k2.c;
        this.b = k2.d;
        this.e = bl2;
        this.f = bl3;
        this.c = k2.e;
        this.d = bl;
        this.h.add(k2.b);
        this.n = w2;
        if (k2.b == OrderEventType.EXECUTION || k2.b == OrderEventType.CANCELLATION || k2.b == OrderEventType.ACTIVE || k2.b == OrderEventType.STOP) {
            this.o.put(k2.b, k2.f);
        }
        this.j = k2.b == OrderEventType.ACTIVE || k2.b == OrderEventType.STOP ? k2.b : OrderEventType.EXECUTION;
        this.l.add(k2.a);
    }

    public void a(k k2, boolean bl) {
        int n2;
        if (bl && !this.e) {
            return;
        }
        if (this.e && !bl) {
            this.e = false;
            this.c = k2.e;
            this.a = k2.c;
            this.b = k2.d;
            this.h.clear();
            this.o.clear();
            this.l.clear();
        } else if (k2.e != 0) {
            if (k2.b == OrderEventType.ACTIVE || k2.b == OrderEventType.STOP) {
                n2 = this.o.getOrDefault((Object)k2.b, 0);
                this.b = (this.b * n2 + k2.d * k2.f) / (n2 + k2.f);
                if (k2.b == OrderEventType.STOP) {
                    long l2 = 0L;
                    long l3 = k2.c - this.a;
                    try {
                        l2 = Math.multiplyExact(l3, k2.f) / (long)(n2 + k2.f);
                    }
                    catch (ArithmeticException arithmeticException) {
                        t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                    }
                    this.a += l2;
                }
            } else {
                this.b = (this.b * this.c + k2.d * k2.e) / (this.c + k2.e);
                long l4 = 0L;
                long l5 = k2.c - this.a;
                try {
                    l4 = Math.multiplyExact(l5, k2.e) / (long)(this.c + k2.e);
                }
                catch (ArithmeticException arithmeticException) {
                    t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l4;
            }
            this.c += k2.e;
        }
        if (k2.b == OrderEventType.EXECUTION || k2.b == OrderEventType.CANCELLATION || k2.b == OrderEventType.ACTIVE || k2.b == OrderEventType.STOP) {
            n2 = this.o.getOrDefault((Object)k2.b, 0);
            this.o.put(k2.b, k2.f + n2);
        }
        this.l.add(k2.a);
        this.h.add(k2.b);
    }

    public void a(c c2) {
        long l2;
        if (c2.e && !this.e) {
            return;
        }
        if (this.e && !c2.e) {
            this.e = false;
            this.a = c2.a;
            this.b = c2.b;
            this.c = c2.c;
            this.h = c2.h;
            this.o = c2.o;
            this.l = c2.l;
            return;
        }
        if (this.j == OrderEventType.ACTIVE || this.j == OrderEventType.STOP) {
            int n2 = this.o.getOrDefault((Object)this.j, 0);
            int n3 = c2.o.getOrDefault((Object)this.j, 0);
            this.b = (this.b * n2 + c2.b * n3) / (n2 + n3);
            if (this.j == OrderEventType.STOP) {
                l2 = 0L;
                long l3 = c2.a - this.a;
                try {
                    l2 = Math.multiplyExact(l3, n3) / (long)(n2 + n3);
                }
                catch (ArithmeticException arithmeticException) {
                    t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l2;
            }
        } else {
            this.h.addAll(c2.h);
            if (this.c + c2.c > 0) {
                this.b = (this.b * this.c + c2.b * c2.c) / (this.c + c2.c);
                long l4 = 0L;
                l2 = c2.a - this.a;
                try {
                    l4 = Math.multiplyExact(l2, c2.c) / (long)(this.c + c2.c);
                }
                catch (ArithmeticException arithmeticException) {
                    t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l4;
            }
        }
        this.c += c2.c;
        for (OrderEventType orderEventType : this.h) {
            int n4 = this.o.getOrDefault((Object)orderEventType, 0);
            int n5 = c2.o.getOrDefault((Object)orderEventType, 0);
            this.o.put(orderEventType, n5 + n4);
        }
        this.l.addAll(c2.l);
        this.m.addAll(c2.m);
    }

    public int a() {
        int n2 = 0;
        for (int n3 : this.o.values()) {
            n2 += n3;
        }
        return n2;
    }

    public ScreenSpaceCanvas.CanvasIcon b() {
        return this.k;
    }

    public void a(ScreenSpaceCanvas.CanvasIcon canvasIcon) {
        this.k = canvasIcon;
    }

    public String a(e e2) {
        Object object = "";
        if (this.h.size() == 1) {
            OrderEventType orderEventType = this.h.iterator().next();
            if (e2.showLetters) {
                switch (orderEventType) {
                    case TRADE: {
                        object = "T";
                        break;
                    }
                    case DETECTION: {
                        object = "D";
                        break;
                    }
                    case EXECUTION: {
                        object = "E";
                        break;
                    }
                    case CANCELLATION: {
                        object = "C";
                        break;
                    }
                    case ACTIVE: 
                    case STOP: {
                        break;
                    }
                    default: {
                        return null;
                    }
                }
            }
            if (e2.showTotals && orderEventType != OrderEventType.TRADE && orderEventType != OrderEventType.DETECTION && orderEventType != OrderEventType.STOP) {
                if (e2.showLetters && orderEventType != OrderEventType.ACTIVE) {
                    object = (String)object + ":";
                }
                object = (String)object + this.o.getOrDefault((Object)orderEventType, 0);
            } else if (e2.showStopsTotals && orderEventType == OrderEventType.STOP) {
                object = (String)object + this.o.getOrDefault((Object)orderEventType, 0);
            }
        } else if (this.h.contains((Object)OrderEventType.EXECUTION) && !this.h.contains((Object)OrderEventType.CANCELLATION)) {
            if (e2.showLetters) {
                object = (String)object + "E";
            }
            if (e2.showTotals) {
                if (e2.showLetters) {
                    object = (String)object + ":";
                }
                object = (String)object + this.o.getOrDefault((Object)OrderEventType.EXECUTION, 0);
            }
        } else if (this.n.a.aggregateEC && this.h.contains((Object)OrderEventType.EXECUTION) && this.h.contains((Object)OrderEventType.CANCELLATION)) {
            if (e2.showLetters) {
                object = (String)object + "E";
            }
            if (e2.showTotals) {
                if (e2.showLetters) {
                    object = (String)object + ":";
                }
                object = (String)object + (this.o.getOrDefault((Object)OrderEventType.EXECUTION, 0) + this.o.getOrDefault((Object)OrderEventType.CANCELLATION, 0));
            }
        } else if (this.h.contains((Object)OrderEventType.EXECUTION) && this.h.contains((Object)OrderEventType.CANCELLATION)) {
            if (e2.showLetters) {
                object = (String)object + "E";
            }
            if (e2.showTotals) {
                if (e2.showLetters) {
                    object = (String)object + ":";
                }
                object = (String)object + this.o.getOrDefault((Object)OrderEventType.EXECUTION, 0);
            }
            if (e2.showLetters || e2.showTotals) {
                object = (String)object + "/";
            }
            if (e2.showLetters) {
                object = (String)object + "C";
            }
            if (e2.showTotals) {
                if (e2.showLetters) {
                    object = (String)object + ":";
                }
                object = (String)object + this.o.getOrDefault((Object)OrderEventType.CANCELLATION, 0);
            }
        } else if (this.h.contains((Object)OrderEventType.CANCELLATION)) {
            if (e2.showLetters) {
                object = (String)object + "C";
            }
            if (e2.showTotals) {
                if (e2.showLetters) {
                    object = (String)object + ":";
                }
                object = (String)object + this.o.getOrDefault((Object)OrderEventType.CANCELLATION, 0);
            }
        } else if (this.h.contains((Object)OrderEventType.TRADE) && e2.showLetters) {
            object = (String)object + "T";
        } else if (this.h.contains((Object)OrderEventType.DETECTION) && e2.showLetters) {
            object = (String)object + "D";
        } else if (this.h.contains((Object)OrderEventType.STOP)) {
            object = (String)object + this.o.getOrDefault((Object)OrderEventType.STOP, 0);
        }
        if (e2.showEventVolumes && !this.h.contains((Object)OrderEventType.EXECUTION) && !this.h.contains((Object)OrderEventType.CANCELLATION) && !this.h.contains((Object)OrderEventType.STOP) && this.c != 0) {
            object = (String)object + "(" + this.c + ")";
        }
        if ((this.j == OrderEventType.STOP && e2.showStopsNumber || this.j != OrderEventType.STOP && e2.showIcebergsNumber) && this.l.size() > 1) {
            object = (String)object + "/" + this.l.size();
        }
        return object;
    }

    void a(Map<OrderEventType, ScreenSpaceCanvas.PreparedImage> map) {
        String string = this.a(this.n.a);
        BufferedImage bufferedImage = this.j == OrderEventType.STOP ? map.get((Object)OrderEventType.STOP).getReadOnlyImage() : map.get((Object)OrderEventType.EXECUTION).getReadOnlyImage();
        int n2 = 0;
        if (string.length() > 0) {
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setFont(this.n.k);
            n2 = graphics2D.getFontMetrics().stringWidth(string);
            graphics2D.dispose();
        }
        int n3 = 0;
        if (this.j == OrderEventType.STOP && this.n.a.showStops || this.j != OrderEventType.STOP && this.n.a.showIcebergs) {
            n3 = bufferedImage.getWidth();
        }
        int n4 = n3 + n2 + 7;
        int n5 = this.j == OrderEventType.STOP ? this.n.a.stopsIconsHeight : this.n.a.icebergsIconsHeight;
        int n6 = (int)((double)n4 / (double)bufferedImage.getHeight() * (double)n5);
        this.g = this.n.a(n6);
    }
}

