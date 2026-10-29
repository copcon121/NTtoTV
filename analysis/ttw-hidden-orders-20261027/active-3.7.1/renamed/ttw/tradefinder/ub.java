/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Pair
 *  velox.gui.colors.Colors
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.AffineTransformOp;
import java.awt.image.BufferedImage;
import java.util.Iterator;
import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import ttw.tradefinder.Pb;
import ttw.tradefinder.af_0;
import ttw.tradefinder.cC;
import ttw.tradefinder.da_1;
import ttw.tradefinder.db_0;
import ttw.tradefinder.fd;
import ttw.tradefinder.he_1;
import ttw.tradefinder.ic_0;
import ttw.tradefinder.je_0;
import ttw.tradefinder.m_0;
import ttw.tradefinder.mb;
import velox.gui.colors.Colors;

public class ub {
    private final af_0 E;
    private final fd j;
    private final m_0 a;
    private static final int h = 2;
    private static final int H = 16;
    private final boolean D;
    private static final int A = 16;
    private final Pb C;
    private Color M = Colors.TRANSPARENT;
    private static final int b = 3;
    private final List<mb> c;

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = (3 ^ 5) << 4 ^ 2 << 1;
        int cfr_ignored_0 = 2 << 3 ^ (3 ^ 5);
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ (2 << 2 ^ 3);
        while (n5 >= 0) {
            int n7 = n3--;
            a2[n7] = (char)(((String)object2).charAt(n7) ^ n6);
            if (n3 < 0) break;
            int n8 = n3--;
            a2[n8] = (char)(((String)object2).charAt(n8) ^ n4);
            n5 = n3;
        }
        return new String((char[])a2);
    }

    public ub(String a2, String a3, af_0 a4, m_0 a5, List<mb> a6, Color a7) {
        ub a8;
        a8.j = new fd(a2);
        a8.C = new Pb("at " + a3);
        ub ub2 = a8;
        ub ub3 = a8;
        ub3.E = a4;
        ub3.a = a5;
        ub2.c = a6;
        ub2.D = a7 != null;
        a8.j(a7 != null ? a7 : Color.WHITE, 255);
    }

    public af_0 ttw_tradefinder_af_0_E() {
        ub a2;
        return a2.E;
    }

    public Color java_awt_Color_E() {
        ub a2;
        return a2.M;
    }

    /*
     * Unable to fully structure code
     */
    public void E(Graphics2D a, int a, int a, Pair<Integer, Integer> a, da_1 a) {
        block31: {
            block29: {
                block33: {
                    block32: {
                        block30: {
                            var6_6 = 0;
                            var7_8 = 0;
                            var8_9 = 0;
                            var9_10 = a.getTransform();
                            if (a.a == ic_0.M) {
                                a = Pair.of((Object)((Integer)a.getRight()), (Object)((Integer)a.getLeft()));
                                var10_11 = AffineTransform.getQuadrantRotateInstance(1, a, a);
                                var10_11.translate(0.0, -((Integer)a.getRight()).intValue());
                                a.setTransform((AffineTransform)var10_11);
                            }
                            if (a.M == cC.b) {
                                v0 = var10_11 = a.c.iterator();
                                while (v0.hasNext()) {
                                    var11_16 = var10_11.next();
                                    var7_8 = Math.max(var7_8, var11_16.j());
                                    var8_9 = Math.max(var8_9, var11_16.a() - var11_16.j());
                                    var6_6 += var11_16.int_E();
                                    v0 = var10_11;
                                }
                                if (var6_6 > 0) {
                                    var6_6 += 4;
                                }
                            }
                            if (a.h != db_0.b) break block29;
                            if (a.M != cC.A) break block30;
                            if (a.a == ic_0.M) {
                                var10_11 = je_0.E(a.E);
                                var11_16 = AffineTransform.getQuadrantRotateInstance(-1, var10_11.getWidth() / 2, var10_11.getHeight() / 2);
                                a = new AffineTransformOp((AffineTransform)var11_16, 2);
                                a.drawImage(a.filter((BufferedImage)var10_11, null), a + 2, a + ((Integer)a.getRight() - 16) / 2, 16, 16, null);
                                v1 = a;
                            } else {
                                a.drawImage(je_0.E(a.E), a + 2, a + ((Integer)a.getRight() - 16) / 2, 16, 16, null);
                                v1 = a;
                            }
                            if (v1.a == null) {
                                return;
                            }
                            a.a.f(a + 16, a, (Integer)a.getLeft() - 16, (Integer)a.getRight(), 0, a);
                            v2 = a;
                            break block31;
                        }
                        if (a.M != cC.C) break block32;
                        a.j.d(a, a, a.j.a(), (Integer)a.getRight(), 0, a);
                        if (a.a == null) {
                            return;
                        }
                        a.a.f(a + a.j.a(), a, a.a.a(), (Integer)a.getRight(), 0, a);
                        v2 = a;
                        break block31;
                    }
                    if (a.M != cC.c) break block33;
                    if (a.C == null) {
                        v3 = 0;
                        v4 = a;
                    } else {
                        v3 = a.C.a();
                        v4 = a;
                    }
                    var10_12 = Math.max(v3, v4.j.a());
                    v5 = a;
                    v5.j.d(a, a, var10_12, a.j.int_E(), 0, a);
                    if (v5.C != null) {
                        a.C.d(a, a + a.j.int_E(), var10_12, a.C.int_E(), 0, a);
                    }
                    if (a.a != null) {
                        a.a.d(a + var10_12, a, a.a.a(), (Integer)a.getRight(), 0, a);
                    }
                    ** GOTO lbl129
                }
                v6 = a;
                var10_13 = v6.j.int_E();
                if (v6.C != null) {
                    var10_13 = Math.max(var10_13, a.C.int_E());
                    v7 = a;
                    v7.j.d(a, a, a.j.a(), var10_13, 0, a);
                    v7.C.g(a.j.a(), a, (Integer)a.getLeft() - a.j.a(), var10_13, 0, a);
                    v8 = a;
                } else {
                    a.j.d(a, a, a.j.a(), a.j.int_E(), 0, a);
                    v8 = a;
                }
                var11_17 = v8 + (Integer)a.getRight() - var6_6;
                v9 = a = a.c.iterator();
                while (v9.hasNext()) {
                    var6_7 = a.next();
                    var6_7.l(a, var11_17, var7_8 + var8_9, var6_7.int_E(), var7_8, a);
                    var11_17 += var6_7.int_E();
                    v9 = a;
                }
                if (a.a == null) {
                    return;
                }
                a.a.f(a + (Integer)a.getLeft() - a.a.a(), a + (Integer)a.getRight() - a.a.int_E(), a.a.a(), a.a.int_E(), 0, a);
                v2 = a;
                break block31;
            }
            if (a.h != db_0.c) ** GOTO lbl129
            if (a.M == cC.A) {
                a.drawImage(je_0.E(a.E), a + ((Integer)a.getLeft() - 16) / 2, a + 2, 16, 16, null);
                if (a.a == null) {
                    return;
                }
                a.a.d(a, a + 16, (Integer)a.getLeft(), (Integer)a.getRight() - 16, 0, a);
                v2 = a;
            } else if (a.M == cC.C) {
                a.j.d(a, a, (Integer)a.getLeft(), a.j.int_E(), 0, a);
                if (a.a == null) {
                    return;
                }
                a.a.d(a, a + a.j.int_E(), (Integer)a.getLeft(), a.a.int_E(), 0, a);
                v2 = a;
            } else {
                if (a.M == cC.c) {
                    a.j.d(a, a, (Integer)a.getLeft(), a.j.int_E(), 0, a);
                    var10_14 = a + a.j.int_E();
                    if (a.C != null) {
                        a.C.d(a, var10_14, (Integer)a.getLeft(), a.C.int_E(), 0, a);
                        var10_14 += a.C.int_E();
                    }
                    if (a.a != null) {
                        a.a.d(a, var10_14, (Integer)a.getLeft(), a.a.int_E(), 0, a);
                    }
                } else {
                    a.j.d(a, a, (Integer)a.getLeft(), a.j.int_E(), 0, a);
                    var10_15 = a + a.j.int_E();
                    if (a.C != null) {
                        a.C.d(a, var10_15, (Integer)a.getLeft(), a.C.int_E(), 0, a);
                        var10_15 += a.C.int_E();
                    }
                    if (a.a != null) {
                        a.a.d(a, var10_15, (Integer)a.getLeft(), a.a.int_E(), 0, a);
                        var10_15 += a.a.int_E();
                    }
                    v10 = var11_16 = a.c.iterator();
                    while (v10.hasNext()) {
                        a = var11_16.next();
                        a.d(a, var10_15, (Integer)a.getLeft(), a.int_E(), (Integer)a.getLeft() / 2, a);
                        var10_15 += a.int_E();
                        v10 = var11_16;
                    }
                }
lbl129:
                // 4 sources

                v2 = a;
            }
        }
        v2.setTransform(var9_10);
    }

    public ub(String a2, String a3, af_0 a4, List<mb> a5) {
        a6(a2, a3, a4, null, a5, null);
        ub a6;
    }

    private /* synthetic */ void E(int a2) {
        Iterator<mb> iterator;
        ub a3;
        if (a3.M.getAlpha() == a2) {
            return;
        }
        ub ub2 = a3;
        ub2.M = he_1.E(ub2.M, a2);
        ub2.j.E(a3.M, a2);
        Iterator<mb> iterator2 = iterator = ub2.c.iterator();
        while (iterator2.hasNext()) {
            ((m_0)iterator.next()).E(a3.M, a2);
            iterator2 = iterator;
        }
        if (a3.C != null) {
            a3.C.void_E(a2);
        }
    }

    public ub(String a2, String a3, af_0 a4, m_0 a5, List<mb> a6) {
        a7(a2, a3, a4, a5, a6, null);
        ub a7;
    }

    /*
     * Unable to fully structure code
     */
    public Pair<Integer, Integer> E(da_1 a) {
        block16: {
            block19: {
                block20: {
                    block17: {
                        block18: {
                            block14: {
                                block15: {
                                    var5_2 = 0;
                                    var3_3 = 0;
                                    if (a.M != cC.b) break block14;
                                    var4_4 = 0;
                                    var2_6 = 0;
                                    var6_8 = 0;
                                    var7_9 = 0;
                                    var8_10 = 0;
                                    v0 = var9_11 = a.c.iterator();
                                    while (v0.hasNext()) {
                                        var10_12 = var9_11.next();
                                        var2_6 = Math.max(var2_6, var10_12.j());
                                        var6_8 = Math.max(var6_8, var10_12.a() - var10_12.j());
                                        var4_4 += var10_12.int_E();
                                        v0 = var9_11;
                                    }
                                    if (var4_4 > 0) {
                                        var4_4 += 4;
                                    }
                                    if (a.C != null) {
                                        v1 = a;
                                        var7_9 = v1.C.int_E();
                                        var8_10 = v1.C.a();
                                    }
                                    if (a.h != db_0.b) break block15;
                                    var5_2 = Math.max(a.j.a() + var8_10, var2_6 + var6_8 + (a.a != null ? a.a.a() : 0));
                                    var3_3 = Math.max(a.j.int_E(), var7_9) + Math.max(var4_4, a.a != null ? a.a.int_E() : 0);
                                    v2 = a;
                                    break block16;
                                }
                                if (a.h == db_0.c) {
                                    var2_6 = var6_8 = Math.max(var2_6, var6_8);
                                    v3 = a.j.a();
                                    if (a.a != null) {
                                        v4 = a.a.a();
                                        v5 = var2_6;
                                    } else {
                                        v4 = 0;
                                        v5 = var2_6;
                                    }
                                    var5_2 = Math.max(v3, Math.max(var8_10, Math.max(v4, v5 + var6_8)));
                                    var3_3 = a.j.int_E() + var7_9 + (a.a != null ? a.a.int_E() : 0) + var4_4;
                                }
                                ** GOTO lbl89
                            }
                            if (a.M != cC.c) break block17;
                            var4_5 = 0;
                            var2_7 = 0;
                            if (a.C != null) {
                                v6 = a;
                                var4_5 = v6.C.int_E();
                                var2_7 = v6.C.a();
                            }
                            if (a.h != db_0.b) break block18;
                            var5_2 = Math.max(a.j.a(), var2_7) + (a.a != null ? a.a.a() : 0);
                            var3_3 = Math.max(a.j.int_E() + var4_5, a.a != null ? a.a.int_E() : 0);
                            v2 = a;
                            break block16;
                        }
                        if (a.h == db_0.c) {
                            v7 = a.j.a();
                            if (a.a != null) {
                                v8 = a.a.a();
                                v9 = var2_7;
                            } else {
                                v8 = 0;
                                v9 = var2_7;
                            }
                            var5_2 = Math.max(v7, Math.max(v8, v9));
                            var3_3 = a.j.int_E() + (a.a != null ? a.a.int_E() : 0) + var4_5;
                        }
                        ** GOTO lbl89
                    }
                    if (a.M != cC.C) break block19;
                    if (a.h != db_0.b) break block20;
                    var5_2 = a.j.a() + (a.a != null ? a.a.a() : 0);
                    var3_3 = Math.max(a.j.int_E(), a.a != null ? a.a.int_E() : 0);
                    v2 = a;
                    break block16;
                }
                if (a.h != db_0.c) ** GOTO lbl89
                var5_2 = Math.max(a.j.a(), a.a != null ? a.a.a() : 0);
                var3_3 = a.j.int_E() + (a.a != null ? a.a.int_E() : 0);
                v2 = a;
                break block16;
            }
            if (a.M != cC.A) ** GOTO lbl89
            if (a.h == db_0.b) {
                var5_2 = 22 + (a.a != null ? a.a.int_E(3) : 0);
                var3_3 = Math.max(20, a.a != null ? a.a.j(3) : 0);
                v2 = a;
            } else {
                if (a.h == db_0.c) {
                    var5_2 = Math.max(20, a.a != null ? a.a.int_E(3) : 0);
                    var3_3 = 22 + (a.a != null ? a.a.j(3) : 0);
                }
lbl89:
                // 7 sources

                v2 = a;
            }
        }
        if (v2.a == ic_0.b) {
            return Pair.of((Object)var5_2, (Object)var3_3);
        }
        return Pair.of((Object)var3_3, (Object)var5_2);
    }

    private /* synthetic */ void j(Color a2, int a3) {
        Iterator<mb> iterator;
        ub a4;
        if (a2 == null || a2.equals(a4.M)) {
            return;
        }
        ub ub2 = a4;
        ub2.M = a2;
        ub2.j.E(a2, a3);
        Iterator<mb> iterator2 = iterator = ub2.c.iterator();
        while (iterator2.hasNext()) {
            ((m_0)iterator.next()).E(a2, a3);
            iterator2 = iterator;
        }
        if (a4.C != null) {
            a4.C.void_E(a3);
        }
    }

    public void E(Color a2, int a3) {
        ub a4;
        if (a4.D) {
            a4.E(a3);
            return;
        }
        a4.j(a2, a3);
    }

    public void E(double a2) {
        ub a3;
        if (Double.compare(a2, 1.0) <= 0) {
            Iterator<mb> iterator;
            ub ub2 = a3;
            ub2.j.E(a2);
            if (ub2.C != null) {
                a3.C.E(a2);
            }
            if (a3.a != null) {
                a3.a.E(a2);
            }
            Iterator<mb> iterator2 = iterator = a3.c.iterator();
            while (iterator2.hasNext()) {
                ((m_0)iterator.next()).E(a2);
                iterator2 = iterator;
            }
            return;
        }
        if (Double.compare(a2, 1.2) <= 0) {
            if (a3.C != null) {
                a3.C.E(a2);
            }
            if (a3.a != null) {
                a3.a.E(a2);
                return;
            }
        } else if (a3.a != null) {
            a3.a.E(a2);
        }
    }
}

