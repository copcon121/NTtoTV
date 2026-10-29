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
import velox.indicators.sionchart.c_0;
import velox.indicators.sionchart.d;
import velox.indicators.sionchart.j;
import velox.indicators.sionchart.k;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.t;

public class b {
    public long a;
    public int b;
    public int c;
    public final boolean d;
    public boolean e;
    public boolean f;
    public long g;
    public HashSet<k> h = new HashSet();
    public ScreenSpaceCanvas.CanvasIcon i;
    public k j;
    public ScreenSpaceCanvas.CanvasIcon k;
    private final t n;
    private HashMap<k, Integer> o = new HashMap();
    public HashSet<l> l = new HashSet();
    public LinkedList<c_0> m = new LinkedList();

    public b(j j2, boolean bl, boolean bl2, boolean bl3, t t2) {
        this.a = j2.c;
        this.b = j2.d;
        this.e = bl2;
        this.f = bl3;
        this.c = j2.e;
        this.d = bl;
        this.h.add(j2.b);
        this.n = t2;
        if (j2.b == velox.indicators.sionchart.k.EXECUTED || j2.b == velox.indicators.sionchart.k.CANCELED || j2.b == velox.indicators.sionchart.k.ACTIVE || j2.b == velox.indicators.sionchart.k.STOP) {
            this.o.put(j2.b, j2.f);
        }
        this.j = j2.b == velox.indicators.sionchart.k.ACTIVE || j2.b == velox.indicators.sionchart.k.STOP ? j2.b : velox.indicators.sionchart.k.EXECUTED;
        this.l.add(j2.a);
    }

    public void a(j j2, boolean bl) {
        int n2;
        if (bl && !this.e) {
            return;
        }
        if (this.e && !bl) {
            this.e = false;
            this.c = j2.e;
            this.a = j2.c;
            this.b = j2.d;
            this.h.clear();
            this.o.clear();
            this.l.clear();
        } else if (j2.e != 0) {
            if (j2.b == velox.indicators.sionchart.k.ACTIVE || j2.b == velox.indicators.sionchart.k.STOP) {
                n2 = this.o.getOrDefault((Object)j2.b, 0);
                this.b = (this.b * n2 + j2.d * j2.f) / (n2 + j2.f);
                if (j2.b == velox.indicators.sionchart.k.STOP) {
                    long l2 = 0L;
                    long l3 = j2.c - this.a;
                    try {
                        l2 = Math.multiplyExact(l3, (long)j2.f) / (long)(n2 + j2.f);
                    }
                    catch (ArithmeticException arithmeticException) {
                        velox.indicators.sionchart.a.t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                    }
                    this.a += l2;
                }
            } else {
                this.b = (this.b * this.c + j2.d * j2.e) / (this.c + j2.e);
                long l4 = 0L;
                long l5 = j2.c - this.a;
                try {
                    l4 = Math.multiplyExact(l5, (long)j2.e) / (long)(this.c + j2.e);
                }
                catch (ArithmeticException arithmeticException) {
                    velox.indicators.sionchart.a.t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l4;
            }
            this.c += j2.e;
        }
        if (j2.b == velox.indicators.sionchart.k.EXECUTED || j2.b == velox.indicators.sionchart.k.CANCELED || j2.b == velox.indicators.sionchart.k.ACTIVE || j2.b == velox.indicators.sionchart.k.STOP) {
            n2 = this.o.getOrDefault((Object)j2.b, 0);
            this.o.put(j2.b, j2.f + n2);
        }
        this.l.add(j2.a);
        this.h.add(j2.b);
    }

    public void a(b b2) {
        long l2;
        if (b2.e && !this.e) {
            return;
        }
        if (this.e && !b2.e) {
            this.e = false;
            this.a = b2.a;
            this.b = b2.b;
            this.c = b2.c;
            this.h = b2.h;
            this.o = b2.o;
            this.l = b2.l;
            return;
        }
        if (this.j == velox.indicators.sionchart.k.ACTIVE || this.j == velox.indicators.sionchart.k.STOP) {
            int n2 = this.o.getOrDefault((Object)this.j, 0);
            int n3 = b2.o.getOrDefault((Object)this.j, 0);
            this.b = (this.b * n2 + b2.b * n3) / (n2 + n3);
            if (this.j == velox.indicators.sionchart.k.STOP) {
                l2 = 0L;
                long l3 = b2.a - this.a;
                try {
                    l2 = Math.multiplyExact(l3, (long)n3) / (long)(n2 + n3);
                }
                catch (ArithmeticException arithmeticException) {
                    velox.indicators.sionchart.a.t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l2;
            }
        } else {
            this.h.addAll(b2.h);
            if (this.c + b2.c > 0) {
                this.b = (this.b * this.c + b2.b * b2.c) / (this.c + b2.c);
                long l4 = 0L;
                l2 = b2.a - this.a;
                try {
                    l4 = Math.multiplyExact(l2, (long)b2.c) / (long)(this.c + b2.c);
                }
                catch (ArithmeticException arithmeticException) {
                    velox.indicators.sionchart.a.t.a("Arithmetic overflow while calculating weighted average for Icebergs on chart");
                }
                this.a += l4;
            }
        }
        this.c += b2.c;
        for (k k2 : this.h) {
            int n4 = this.o.getOrDefault((Object)k2, 0);
            int n5 = b2.o.getOrDefault((Object)k2, 0);
            this.o.put(k2, n5 + n4);
        }
        this.l.addAll(b2.l);
        this.m.addAll(b2.m);
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

    public String a(d d2) {
        String string = "";
        if (this.h.size() == 1) {
            k k2 = this.h.iterator().next();
            if (d2.showLetters) {
                switch (k2) {
                    case TRADE: {
                        string = "T";
                        break;
                    }
                    case DETECTED: {
                        string = "D";
                        break;
                    }
                    case EXECUTED: {
                        string = "E";
                        break;
                    }
                    case CANCELED: {
                        string = "C";
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
            if (d2.showTotals && k2 != velox.indicators.sionchart.k.TRADE && k2 != velox.indicators.sionchart.k.DETECTED && k2 != velox.indicators.sionchart.k.STOP) {
                if (d2.showLetters && k2 != velox.indicators.sionchart.k.ACTIVE) {
                    string = string + ":";
                }
                string = string + this.o.getOrDefault((Object)k2, 0);
            } else if (d2.showStopsTotals && k2 == velox.indicators.sionchart.k.STOP) {
                string = string + this.o.getOrDefault((Object)k2, 0);
            }
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.EXECUTED) && !this.h.contains((Object)velox.indicators.sionchart.k.CANCELED)) {
            if (d2.showLetters) {
                string = string + "E";
            }
            if (d2.showTotals) {
                if (d2.showLetters) {
                    string = string + ":";
                }
                string = string + this.o.getOrDefault((Object)velox.indicators.sionchart.k.EXECUTED, 0);
            }
        } else if (this.n.a.aggregateEC && this.h.contains((Object)velox.indicators.sionchart.k.EXECUTED) && this.h.contains((Object)velox.indicators.sionchart.k.CANCELED)) {
            if (d2.showLetters) {
                string = string + "E";
            }
            if (d2.showTotals) {
                if (d2.showLetters) {
                    string = string + ":";
                }
                string = string + (this.o.getOrDefault((Object)velox.indicators.sionchart.k.EXECUTED, 0) + this.o.getOrDefault((Object)velox.indicators.sionchart.k.CANCELED, 0));
            }
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.EXECUTED) && this.h.contains((Object)velox.indicators.sionchart.k.CANCELED)) {
            if (d2.showLetters) {
                string = string + "E";
            }
            if (d2.showTotals) {
                if (d2.showLetters) {
                    string = string + ":";
                }
                string = string + this.o.getOrDefault((Object)velox.indicators.sionchart.k.EXECUTED, 0);
            }
            if (d2.showLetters || d2.showTotals) {
                string = string + "/";
            }
            if (d2.showLetters) {
                string = string + "C";
            }
            if (d2.showTotals) {
                if (d2.showLetters) {
                    string = string + ":";
                }
                string = string + this.o.getOrDefault((Object)velox.indicators.sionchart.k.CANCELED, 0);
            }
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.CANCELED)) {
            if (d2.showLetters) {
                string = string + "C";
            }
            if (d2.showTotals) {
                if (d2.showLetters) {
                    string = string + ":";
                }
                string = string + this.o.getOrDefault((Object)velox.indicators.sionchart.k.CANCELED, 0);
            }
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.TRADE) && d2.showLetters) {
            string = string + "T";
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.DETECTED) && d2.showLetters) {
            string = string + "D";
        } else if (this.h.contains((Object)velox.indicators.sionchart.k.STOP)) {
            string = string + this.o.getOrDefault((Object)velox.indicators.sionchart.k.STOP, 0);
        }
        if (d2.showEventVolumes && !this.h.contains((Object)velox.indicators.sionchart.k.EXECUTED) && !this.h.contains((Object)velox.indicators.sionchart.k.CANCELED) && !this.h.contains((Object)velox.indicators.sionchart.k.STOP) && this.c != 0) {
            string = string + "(" + this.c + ")";
        }
        if ((this.j == velox.indicators.sionchart.k.STOP && d2.showStopsNumber || this.j != velox.indicators.sionchart.k.STOP && d2.showIcebergsNumber) && this.l.size() > 1) {
            string = string + "/" + this.l.size();
        }
        return string;
    }

    void a(Map<k, ScreenSpaceCanvas.PreparedImage> map) {
        String string = this.a(this.n.a);
        BufferedImage bufferedImage = this.j == velox.indicators.sionchart.k.STOP ? map.get((Object)velox.indicators.sionchart.k.STOP).getReadOnlyImage() : map.get((Object)velox.indicators.sionchart.k.EXECUTED).getReadOnlyImage();
        int n2 = 0;
        if (string.length() > 0) {
            Graphics2D graphics2D = bufferedImage.createGraphics();
            graphics2D.setFont(this.n.k);
            n2 = graphics2D.getFontMetrics().stringWidth(string);
            graphics2D.dispose();
        }
        int n3 = 0;
        if (this.j == velox.indicators.sionchart.k.STOP && this.n.a.showStops || this.j != velox.indicators.sionchart.k.STOP && this.n.a.showIcebergs) {
            n3 = bufferedImage.getWidth();
        }
        int n4 = n3 + n2 + 7;
        int n5 = this.j == velox.indicators.sionchart.k.STOP ? this.n.a.stopsIconsHeight : this.n.a.icebergsIconsHeight;
        int n6 = (int)((double)n4 / (double)bufferedImage.getHeight() * (double)n5);
        this.g = this.n.a(n6);
    }
}

