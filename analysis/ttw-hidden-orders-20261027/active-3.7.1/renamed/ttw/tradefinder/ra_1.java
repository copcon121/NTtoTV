/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import ttw.tradefinder.O;
import ttw.tradefinder.gb_1;
import ttw.tradefinder.na_0;

/*
 * Renamed from ttw.tradefinder.rA
 */
public class ra_1 {
    private final List<gb_1> M;
    private final O b;
    private final Object c;

    public ra_1(O a2) {
        ra_1 a3;
        ra_1 ra_12 = a3;
        ra_12.c = new Object();
        ra_12.M = new ArrayList<gb_1>();
        ra_12.b = a2;
    }

    public void j() {
        ra_1 a2;
        Object object = a2.c;
        synchronized (object) {
            a2.M.clear();
            return;
        }
    }

    public void E(int a2, int a3) {
        Object object;
        ra_1 a4;
        ArrayList<gb_1> arrayList = new ArrayList<gb_1>();
        Iterator iterator = a4.c;
        synchronized (iterator) {
            object = a4.M.iterator();
            while (object.hasNext()) {
                gb_1 gb_12 = object.next();
                if (!gb_12.E(a2, a3)) continue;
                arrayList.add(gb_12);
                object.remove();
            }
        }
        Iterator iterator2 = iterator = arrayList.iterator();
        while (iterator2.hasNext()) {
            object = (gb_1)iterator.next();
            iterator2 = iterator;
            a4.b.void_E((gb_1)object);
        }
    }

    public void E() {
        ra_1 a2;
        a2.j();
    }

    public void E(int a2, na_0 a3, int a4, int a5) {
        ra_1 a6;
        if (!a3.C || a3.H <= a4 && a3.H >= a5) {
            return;
        }
        Object object = a6.c;
        synchronized (object) {
            a6.M.add(new gb_1(a2, a3, a4, a5));
            return;
        }
    }

    public static String E(Object object) {
        Object object2 = object;
        object2 = (String)object2;
        int n2 = ((String)object2).length();
        int n3 = n2 - 1;
        Object a2 = new char[n2];
        int n4 = 5 << 4 ^ 1 << 1;
        int cfr_ignored_0 = 1 << 3 ^ (3 ^ 5);
        int n5 = n3;
        int n6 = (2 ^ 5) << 4 ^ 2 << 1;
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
}

