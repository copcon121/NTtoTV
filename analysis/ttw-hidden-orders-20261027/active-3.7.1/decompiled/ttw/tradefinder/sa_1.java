/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import java.awt.Component;
import java.io.Serializable;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import ttw.tradefinder.bb_2;
import ttw.tradefinder.bd_0;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ec_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.hK;
import ttw.tradefinder.kb_0;
import ttw.tradefinder.mb_0;
import ttw.tradefinder.na_0;
import ttw.tradefinder.ne_1;
import ttw.tradefinder.oa_0;
import ttw.tradefinder.od;
import ttw.tradefinder.pc_0;
import ttw.tradefinder.qe_2;
import ttw.tradefinder.sc_1;
import ttw.tradefinder.ze_2;

/*
 * Renamed from ttw.tradefinder.SA
 * Duplicate member names - consider using --renamedupmembers true
 */
public class sa_1
extends sc_1 {
    private final ze_2 C;
    private final df_0<oa_0, hK> M;
    private final String b;
    public static final long C = 74148236912335L;
    private final f_0 c;

    public void A() {
    }

    private /* synthetic */ JSpinner E(na_0 a2) {
        sa_1 a3;
        sa_1 sa_12 = a3;
        Object object = sa_12.C.E();
        double d2 = sa_12.C.c;
        double d3 = d2 * 1.0E9;
        double d4 = sa_12.C.c;
        double d5 = Math.max(d2, Math.min(d3, (double)a2.H * a3.C.c));
        Serializable serializable = new SpinnerNumberModel(d5, d2, d3, d4);
        serializable = new JSpinner((SpinnerModel)((Object)serializable));
        object = new JSpinner.NumberEditor((JSpinner)serializable, (String)object);
        Serializable serializable2 = serializable;
        ((JSpinner)serializable2).setEditor((JComponent)object);
        ((JSpinner)serializable2).addChangeListener(new pc_0(a3, (JSpinner)serializable, a2));
        return serializable2;
    }

    private /* synthetic */ JTextField E(na_0 a2) {
        sa_1 a3;
        JTextField jTextField = new JTextField(10);
        jTextField.putClientProperty(qe_2.E("E^jr{Lfocn!iz~Le\u007fsNfcexok"), Boolean.TRUE);
        JTextField jTextField2 = jTextField;
        JTextField jTextField3 = jTextField;
        JTextField jTextField4 = jTextField;
        ne_1.E(jTextField);
        jTextField4.setHorizontalAlignment(0);
        jTextField4.setText(a2.b);
        jTextField3.setFont(jTextField3.getFont().deriveFont(13.0f));
        jTextField2.setBackground(a2.M);
        jTextField3.addFocusListener(new od(a3, jTextField, a2));
        jTextField2.addKeyListener(new bd_0(a3, jTextField, a2));
        jTextField2.addMouseListener(new ec_1(a3, jTextField, a2));
        return jTextField2;
    }

    public void d() {
        sa_1 a2;
        sa_1 sa_12 = a2;
        sa_12.E();
        ((oa_0)sa_12.M.M).E(new kb_0(a2));
    }

    private /* synthetic */ JCheckBox E(na_0 a2, int a32) {
        sa_1 a4;
        JCheckBox a32 = new JCheckBox(bb_2.E("\u0018;<710"));
        a32.setSelected(a2.C);
        JCheckBox jCheckBox = a32;
        jCheckBox.addItemListener(new mb_0(a4, a32, a2));
        return jCheckBox;
    }

    public sa_1(String a2, ze_2 a3, f_0 a4) {
        sa_1 a5;
        sa_1 sa_12 = a5;
        sa_1 sa_13 = a5;
        super(a3.M, null);
        a5.b = a2;
        sa_13.c = a4;
        sa_13.C = a3;
        sa_12.M = a4.E(sa_12.b, a3.M, new oa_0());
        sa_12.d();
    }

    private /* synthetic */ void E(na_0 a2, int a32) {
        sa_1 a4;
        sa_1 sa_12 = a4;
        JCheckBox a32 = sa_12.E((na_0)a2, a32);
        JTextField jTextField = sa_12.E((na_0)a2);
        a2 = sa_12.E((na_0)a2);
        sa_12.j((Component)a32, (Component)jTextField, (Component)a2);
    }
}

