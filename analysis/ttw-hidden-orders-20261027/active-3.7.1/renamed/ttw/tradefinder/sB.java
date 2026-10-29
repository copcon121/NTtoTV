/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JSlider;
import ttw.tradefinder.Oc;
import ttw.tradefinder.ac_1;
import ttw.tradefinder.eb_1;
import ttw.tradefinder.ee;
import ttw.tradefinder.iB;
import ttw.tradefinder.n;
import ttw.tradefinder.nc_1;
import ttw.tradefinder.nd_2;
import ttw.tradefinder.qE;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.wc;

public class sB
extends sc_1 {
    private final ac_1 c;
    public static final long C = 79142854832545L;

    public sB(String a2, String a3, n a4) {
        super(a2, a3 + " Settings");
        sB a5;
        sB sB2 = a5;
        n n2 = a4;
        a5.c = new ac_1(a4);
        sB sB3 = a5;
        n2.E(sB3, new wc(sB3));
        sB2.E(n2);
        sB2.j(a4);
        sB2.f(sB2.c);
        a5.void_a();
    }

    private /* synthetic */ void j(n a2) {
        sB a3;
        int n2;
        String string = ee.E(a2.ttw_tradefinder_eb_1_E());
        String[] stringArray = ee.E(eb_1.M).toArray(new String[0]);
        JComboBox<String> jComboBox = new JComboBox<String>(stringArray);
        int n3 = stringArray.length;
        int n4 = n2 = 0;
        while (n4 < n3) {
            if (stringArray[n2].equals(string)) {
                jComboBox.setSelectedItem(string);
            }
            n4 = ++n2;
        }
        JComboBox<String> jComboBox2 = jComboBox;
        jComboBox2.setEditable(false);
        jComboBox2.addActionListener(new nc_1(a3, jComboBox, a2));
        a3.a(new JLabel(nd_2.E("j^@F\\")), jComboBox);
    }

    private /* synthetic */ void E(n a2) {
        sB a3;
        int n2 = Math.max(1, Math.min(8, a2.int_E()));
        JSlider jSlider = new JSlider(0, 1, 8, n2);
        jSlider.addChangeListener(new iB(a3, (n)a2));
        a2 = qE.E(1, 8, 1);
        a3.j(new JLabel(nd_2.E("mBPIRD\\YJ")), (Component)jSlider, qE.E(Oc.E("w\u000bA\u0010Z\t\u0015']\u0005G\u0010\u0015(\\\nPDa\f\\\u0007^\nP\u0017F"), a2));
    }
}

