/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import javax.imageio.ImageIO;
import javax.swing.AbstractButton;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JScrollPane;
import ttw.tradefinder.ac_2;
import ttw.tradefinder.af_0;
import ttw.tradefinder.ba_2;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ie_0;
import ttw.tradefinder.je_0;
import ttw.tradefinder.md_2;
import ttw.tradefinder.ne_2;
import ttw.tradefinder.nf_0;
import ttw.tradefinder.rf_1;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ue_1;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.xf_2;
import ttw.tradefinder.z_0;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.ID
 */
public class id_2 {
    private static final BufferedImage C;
    private static final BufferedImage M;
    private final Set<z_0> b = new HashSet<z_0>();
    private final Map<String, JScrollPane> c = new LinkedHashMap<String, JScrollPane>();

    private static /* synthetic */ BufferedImage java_awt_image_BufferedImage_j() {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(ac_2.E("\u000by\u0003s\u0007gMg\u0007`\u0016}\fs\u0011:\u0012z\u0005")));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    public void E(List<z_0> a2, f_0 a3) {
        id_2 a4;
        a3 = a4.b;
        synchronized (a3) {
            Object object = a2 = a2.iterator();
            while (object.hasNext()) {
                z_0 z_02 = (z_0)a2.next();
                object = a2;
                a4.b.add(z_02);
            }
            return;
        }
    }

    public void j(String a2) {
        id_2 a3;
        Set<z_0> set = a3.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a3.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_E(a2);
                iterator2 = iterator;
            }
            return;
        }
    }

    public id_2() {
        id_2 a2;
    }

    public void a() {
        id_2 a2;
        Set<z_0> set = a2.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a2.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_E();
                iterator2 = iterator;
            }
            return;
        }
    }

    private /* synthetic */ void E(ze_2 a2, f_0 a3, ne_2 a4, sc_1 a5, List<String> a6) {
        ArrayList<? extends sc_1> arrayList = new ArrayList<sc_1>();
        TreeMap<Integer, sc_1> treeMap = new TreeMap<Integer, sc_1>();
        a4 = ((ne_2)((Object)a4)).E().iterator();
        block0: while (true) {
            Iterator<Object> iterator = a4;
            while (iterator.hasNext()) {
                sc_1 sc_12;
                JLabel jLabel;
                id_2 a7;
                ne_2 ne_22 = (ne_2)a4.next();
                if (a6.contains(ne_22.java_lang_String_E())) continue block0;
                ne_2 ne_23 = ne_22;
                a6.add(ne_23.java_lang_String_E());
                if (!ne_23.E(a2.j, a3.boolean_j())) continue block0;
                sc_1 sc_13 = new sc_1(a2.M, ne_22, a3);
                id_2 id_22 = a7;
                id_22.E(a2, a3, ne_22, sc_13, a6);
                arrayList.addAll(id_22.E(a2, a3, ne_22, sc_13, a5));
                if (sc_13.boolean_j()) continue block0;
                TreeMap<Integer, sc_1> treeMap2 = treeMap;
                int n2 = sc_13.int_E();
                while (treeMap2.containsKey(n2)) {
                    treeMap2 = treeMap;
                    ++n2;
                }
                if (sc_13.ttw_tradefinder_xf_1_E() == xf_1.M) {
                    iterator = a4;
                    treeMap.put(n2, sc_13);
                    continue;
                }
                if (sc_13.ttw_tradefinder_af_0_E() != af_0.B) {
                    jLabel = new JLabel(sc_13.m, new ImageIcon(je_0.E(sc_13.ttw_tradefinder_af_0_E(), 28, 28)), 2);
                    sc_12 = sc_13;
                } else {
                    jLabel = new JLabel(sc_13.m);
                    sc_12 = sc_13;
                }
                if (sc_12.ttw_tradefinder_xf_1_E() == xf_1.C) {
                    sc_1 sc_14 = new sc_1(a2.M, ne_22, a3);
                    new sc_1(a2.M, ne_22, a3).m = null;
                    iterator = a4;
                    sc_14.E(jLabel, a7.E(a2.M, sc_13.m, sc_13));
                    treeMap.put(n2, sc_14);
                    continue;
                }
                sc_1 sc_15 = new sc_1(a2.M, ne_22, a3);
                new sc_1(a2.M, ne_22, a3).m = "";
                sc_15.E(jLabel, a7.E(a2.M, sc_13.m, sc_13));
                treeMap.put(n2, sc_15);
                continue block0;
            }
            break;
        }
        for (sc_1 sc_16 : treeMap.values()) {
            int n3 = a5.f((Component)((Object)new ue_1(sc_16)));
            if (!sc_16.boolean_a() || a5.ttw_tradefinder_xf_1_E() != xf_1.M) continue;
            a5.void_E(n3);
        }
        for (sc_1 sc_17 : arrayList) {
            int n4 = a5.f((Component)((Object)new ue_1(sc_17)));
            if (!sc_17.boolean_a() || a5.ttw_tradefinder_xf_1_E() != xf_1.M) continue;
            a5.void_E(n4);
        }
    }

    public void j(long a2) {
        id_2 a3;
        Set<z_0> set = a3.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a3.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().j(a2);
                iterator2 = iterator;
            }
            return;
        }
    }

    public void E(long a2) {
        id_2 a3;
        Set<z_0> set = a3.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a3.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().E(a2);
                iterator2 = iterator;
            }
            return;
        }
    }

    public Set<String> E() {
        id_2 a2;
        HashSet<String> hashSet = new HashSet<String>();
        Set<z_0> set = a2.b;
        synchronized (set) {
            for (z_0 z_02 : a2.b) {
                Iterator<String> iterator = z_02.E().iterator();
                while (iterator.hasNext()) {
                    Iterator<String> object;
                    String string = object.next();
                    iterator = object;
                    hashSet.add(string);
                }
            }
            return hashSet;
        }
    }

    public Component E(String a2, String a3, sc_1 a4) {
        id_2 a5;
        String string = a2 + a4.java_lang_String_E();
        sc_1 sc_12 = a4;
        sc_12.void_a();
        sc_12.void_j();
        if (a5.c.containsKey(string)) {
            a5.c.get(string).setViewportView(a4);
        } else {
            a4 = new JScrollPane(a4, 20, 31);
            a4.setPreferredSize(new Dimension(550, 800));
            JComponent jComponent = a4;
            jComponent.setMaximumSize(new Dimension(550, 1200));
            jComponent.setMinimumSize(new Dimension(550, 800));
            ((JScrollPane)jComponent).getVerticalScrollBar().setUnitIncrement(15);
            a5.c.put(string, (JScrollPane)a4);
        }
        a4 = new JButton(ac_2.E("Q\u0006}\u0016"), new ImageIcon(C));
        ((AbstractButton)a4).addActionListener(new md_2(a5, (JButton)a4, string, a3, a2));
        return a4;
    }

    static {
        M = id_2.java_awt_image_BufferedImage_j();
        C = id_2.java_awt_image_BufferedImage_E();
    }

    /*
     * Unable to fully structure code
     */
    public Collection<? extends sc_1> E(ze_2 a, f_0 a) {
        var7_4 = a.b;
        synchronized (var7_4) {
            var4_5 = new ArrayList<String>();
            var5_6 = new ArrayList<sc_1>();
            var6_7 = a.b.iterator();
            block5: while (true) {
                v0 = var6_7;
                while (v0.hasNext()) {
                    var3_8 = var6_7.next();
                    var8_9 = var3_8.j();
                    if (var8_9.size() > 0) {
                        v1 = var3_8 = var8_9.iterator();
                        while (true) {
                            if (!v1.hasNext()) continue block5;
                            var8_9 = (ne_2)var3_8.next();
                            v1 = var3_8;
                            var5_6.addAll(a.E(a, a, (ne_2)var8_9, var4_5));
                        }
                    }
                    if (!var4_5.contains(var3_8.java_lang_String_E())) ** break;
                    continue block5;
                    v0 = var6_7;
                    var4_5.add(var3_8.java_lang_String_E());
                    var5_6.addAll(var3_8.E(a, null, nf_0.O, null));
                }
                break;
            }
            return var5_6;
        }
    }

    public void E(ze_2 a2, xf_2 a3) {
        id_2 a4;
        Set<z_0> set = a4.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a4.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_E(a2, a3);
                iterator2 = iterator;
            }
            return;
        }
    }

    public void void_j() {
        id_2 a2;
        Set<z_0> set = a2.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a2.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().a();
                iterator2 = iterator;
            }
            a2.b.clear();
            return;
        }
    }

    private static /* synthetic */ BufferedImage java_awt_image_BufferedImage_E() {
        try {
            return ImageIO.read(ba_2.class.getClassLoader().getResourceAsStream(ie_0.E("\b5\u0000?\u0004+N?\u00049\u0013v\u00116\u0006")));
        }
        catch (Exception exception) {
            return new BufferedImage(1, 1, 2);
        }
    }

    public z_0 ttw_tradefinder_z_0_E(String a2) {
        id_2 a3;
        Set<z_0> set = a3.b;
        synchronized (set) {
            for (z_0 z_02 : a3.b) {
                if (!z_02.boolean_E(a2)) continue;
                return z_02;
            }
            return null;
        }
    }

    public void void_E(String a2) {
        id_2 a3;
        Set<z_0> set = a3.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a3.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().void_j(a2);
                iterator2 = iterator;
            }
            return;
        }
    }

    private /* synthetic */ Collection<? extends sc_1> E(ze_2 a2, f_0 a3, ne_2 a4, List<String> a5) {
        id_2 a6;
        Object object;
        Object object2;
        ArrayList<Object> arrayList = new ArrayList<Object>();
        Object object3 = object2 = a4.j().iterator();
        while (object3.hasNext()) {
            object = object2.next();
            object3 = object2;
            arrayList.addAll(a6.E(a2, a3, (ne_2)object, a5));
        }
        if (a5.contains(a4.java_lang_String_E())) {
            return arrayList;
        }
        a5.add(a4.java_lang_String_E());
        if (!a4.E(a2.j, a3.boolean_j())) {
            return arrayList;
        }
        object2 = new sc_1(a2.M, a4, a3);
        id_2 id_22 = a6;
        id_22.E(a2, a3, a4, (sc_1)object2, a5);
        arrayList.addAll(id_22.E(a2, a3, a4, (sc_1)object2, (sc_1)null));
        if (!((sc_1)object2).boolean_j()) {
            if (((sc_1)object2).ttw_tradefinder_xf_1_E() == xf_1.M) {
                ArrayList<Object> arrayList2 = arrayList;
                arrayList2.add(object2);
                return arrayList2;
            }
            if (((sc_1)object2).ttw_tradefinder_xf_1_E() == xf_1.C) {
                object = new sc_1(a2.M, a4, a3);
                new sc_1(a2.M, a4, a3).m = null;
                ArrayList<Object> arrayList3 = arrayList;
                ((sc_1)object).E(new JLabel(((sc_1)object2).m), a6.E(a2.M, ((sc_1)object2).m, (sc_1)object2));
                arrayList3.add(object);
                return arrayList3;
            }
            object = new sc_1(a2.M, a4, a3);
            new sc_1(a2.M, a4, a3).m = "";
            ((sc_1)object).E(new JLabel(((sc_1)object2).m), a6.E(a2.M, ((sc_1)object2).m, (sc_1)object2));
            arrayList.add(object);
        }
        return arrayList;
    }

    private /* synthetic */ Collection<? extends sc_1> E(ze_2 a2, f_0 a3, ne_2 a4, sc_1 a5, sc_1 a6) {
        ArrayList<? extends sc_1> arrayList = new ArrayList<sc_1>();
        a4 = ((ne_2)a4).a().iterator();
        block0: while (true) {
            Object object = a4;
            while (object.hasNext()) {
                rf_1 rf_12 = (rf_1)a4.next();
                if (rf_12.c == nf_0.M || rf_12.c == nf_0.m && !a3.boolean_j()) continue block0;
                arrayList.addAll(rf_12.b.E(a2, a5, rf_12.c, a6));
                object = a4;
            }
            break;
        }
        return arrayList;
    }

    public void void_E() {
        id_2 a2;
        Set<z_0> set = a2.b;
        synchronized (set) {
            Iterator<z_0> iterator;
            Iterator<z_0> iterator2 = iterator = a2.b.iterator();
            while (iterator2.hasNext()) {
                iterator.next().j();
                iterator2 = iterator;
            }
            return;
        }
    }
}

