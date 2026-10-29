/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.List;
import ttw.tradefinder.cd;
import ttw.tradefinder.dd_1;

/*
 * Renamed from ttw.tradefinder.bD
 */
public class bd_2 {
    /*
     * Enabled aggressive block sorting
     */
    public static /* synthetic */ boolean E(dd_1 a2, cd a3) {
        if (a3 == cd.H || a2 == dd_1.M) {
            return true;
        }
        if (a2 == dd_1.C) {
            switch (a3) {
                case C: {
                    return true;
                }
            }
            return false;
        }
        if (a2 == dd_1.D) {
            switch (a3) {
                case C: 
                case c: {
                    return true;
                }
            }
            return false;
        }
        if (a2 == dd_1.A) {
            switch (a3) {
                case C: 
                case h: 
                case A: 
                case D: {
                    return true;
                }
            }
            return false;
        }
        if (a2 != dd_1.c) {
            return false;
        }
        switch (a3) {
            case C: 
            case h: 
            case A: {
                return true;
            }
        }
        return false;
    }

    public /* synthetic */ bd_2() {
        bd_2 a2;
    }

    public static /* synthetic */ List<dd_1> E() {
        ArrayList<dd_1> arrayList = new ArrayList<dd_1>();
        arrayList.add(dd_1.C);
        arrayList.add(dd_1.D);
        arrayList.add(dd_1.A);
        arrayList.add(dd_1.c);
        return arrayList;
    }
}

