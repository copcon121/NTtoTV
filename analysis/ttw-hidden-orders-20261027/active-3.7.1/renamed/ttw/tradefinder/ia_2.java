/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.IndicatorLineStyle
 */
package ttw.tradefinder;

import ttw.tradefinder.ac_0;
import ttw.tradefinder.c;
import ttw.tradefinder.df_0;
import ttw.tradefinder.ed_1;
import ttw.tradefinder.f_0;
import ttw.tradefinder.ff_1;
import ttw.tradefinder.oe_1;
import ttw.tradefinder.s_0;
import ttw.tradefinder.tb_0;
import ttw.tradefinder.ze_2;
import velox.api.layer1.messages.indicators.IndicatorLineStyle;

/*
 * Renamed from ttw.tradefinder.IA
 */
public class ia_2
extends ed_1 {
    private boolean M;
    private final df_0<tb_0, c> b;
    private final ff_1 c;

    @Override
    public IndicatorLineStyle velox_api_layer1_messages_indicators_IndicatorLineStyle_E() {
        ia_2 a2;
        return ac_0.velox_api_layer1_messages_indicators_IndicatorLineStyle_E(((tb_0)a2.b.M).b, ((tb_0)a2.b.M).c);
    }

    public ia_2(f_0 a2, ze_2 a3, df_0<tb_0, c> a4, ff_1 a5, s_0 a6) {
        ia_2 a7;
        ia_2 ia_22 = a7;
        super(a2, a3, a6);
        a7.M = true;
        ia_22.c = a5;
        ia_22.b = a4;
    }

    @Override
    public boolean boolean_j() {
        ia_2 a2;
        return a2.M;
    }

    @Override
    public void E(ff_1 a2, double a3, long a4) {
        ia_2 a5;
        if (a2 != a5.c) {
            return;
        }
        a5.E(a3, a4);
    }

    @Override
    public void E(ff_1 a2, oe_1 a3, boolean a4) {
        ia_2 a5;
        if (a2 != a5.c) {
            return;
        }
        if (a3 == oe_1.M) {
            a5.a(a4);
            return;
        }
        if (a3 == oe_1.c) {
            a5.M = a4;
            a5.void_E(false);
            return;
        }
        if (a3 == oe_1.b && a4) {
            a5.a();
        }
    }

    @Override
    public void E(ff_1 a2) {
        ia_2 a3;
        if (a2 != a3.c) {
            return;
        }
        a3.void_E(true);
    }
}

