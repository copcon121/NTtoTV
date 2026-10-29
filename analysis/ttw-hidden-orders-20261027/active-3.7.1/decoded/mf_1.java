/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import ttw.tradefinder.Ff;
import ttw.tradefinder.ce_2;
import ttw.tradefinder.df_0;
import ttw.tradefinder.df_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.f_0;
import ttw.tradefinder.hd_0;
import ttw.tradefinder.j;
import ttw.tradefinder.sa;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.xf_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.mF
 */
public class mf_1 {
    private final f_0 b;
    private final ze_2 c;

    private /* synthetic */ void E(sc_1 a2, ze_2 a3, df_0<sa, j> a4) {
        mf_1 a5;
        int n2;
        a3 = ee.E(((sa)a4.M).c);
        String[] stringArray = ee.E(df_1.b).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(a3)) {
                jComboBox.setSelectedItem(a3);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new ce_2(a5, jComboBox, a4));
        a2.a(new JLabel("Sound Alerts"), jComboBox);
    }

    public mf_1(f_0 a2, ze_2 a3) {
        mf_1 a4;
        mf_1 mf_12 = a4;
        mf_12.b = a2;
        mf_12.c = a3;
    }

    public Collection<? extends sc_1> E(int a22) {
        mf_1 a3;
        if (!a3.b.j()) {
            return Collections.emptyList();
        }
        mf_1 mf_12 = a3;
        df_0<sa, j> df_02 = mf_12.b.E(mf_12.b.E(), new sa());
        sc_1 a22 = new sc_1(a3.c.M, "Global Settings", a22, false, xf_1.M, a3.b);
        mf_12.E(a22, a3.c, df_02);
        return Arrays.asList(a22);
    }
}

