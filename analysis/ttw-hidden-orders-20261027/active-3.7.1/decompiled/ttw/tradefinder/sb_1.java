/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.ArrayList;
import java.util.List;
import javax.swing.JButton;
import ttw.tradefinder.ae_1;
import ttw.tradefinder.b_0;
import ttw.tradefinder.cd;
import ttw.tradefinder.ed_2;
import ttw.tradefinder.gf_0;
import ttw.tradefinder.qE;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.vE;
import ttw.tradefinder.zc_2;

/*
 * Renamed from ttw.tradefinder.Sb
 */
public class sb_1
implements b_0 {
    private final JButton b;
    private final boolean c;

    public /* synthetic */ sb_1(List<cd> a2, boolean a3) {
        sb_1 a4;
        sb_1 sb_12 = a4;
        sb_12.c = a3;
        sb_12.b = sc_1.E(sb_12.E(a2));
    }

    @Override
    public /* synthetic */ void E(List<cd> a2) {
        sb_1 a3;
        a3.b.setToolTipText(a3.E(a2).M);
    }

    public /* synthetic */ JButton E() {
        sb_1 a2;
        return a2.b;
    }

    private /* synthetic */ vE E(List<cd> a2) {
        ArrayList<String> arrayList = new ArrayList<String>();
        if (a2.size() > 1) {
            sb_1 a3;
            arrayList.add("");
            if (a3.c) {
                arrayList.add(ed_2.E("gvR|Pp\u0006FSwUvT|VaOzHf\u001c"));
                a2 = a2.iterator();
                Object object = a2;
                while (object.hasNext()) {
                    cd cd2 = (cd)((Object)a2.next());
                    object = a2;
                    arrayList.add(zc_2.E(cd2));
                }
            } else {
                arrayList.add(ae_1.E("EMh\u0001PuS\u0001wTfRgSmQpHkOw\u0001eSa\u0001pDiQkSeS}\u0001aOeChD`\u0001bNv\u0001VDtMeX$lkEa\u000f"));
            }
            arrayList.add("");
        }
        return qE.E(gf_0.c, arrayList.toArray(new String[0]), ed_2.E("}RaVf\u001c:\taRbRgGqCg\bvIx\txCxDpTf\t"));
    }
}

