/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.messages.indicators.IndicatorLineStyle
 */
package ttw.tradefinder;

import java.awt.BasicStroke;
import java.awt.Stroke;
import ttw.tradefinder.eb_1;
import velox.api.layer1.messages.indicators.IndicatorLineStyle;

/*
 * Renamed from ttw.tradefinder.AC
 */
public class ac_0 {
    public static Stroke java_awt_Stroke_E(int a2, eb_1 a3) {
        switch (a3) {
            case M: {
                return new BasicStroke(a2);
            }
            case A: {
                return new BasicStroke(a2, 0, 2, 0.0f, new float[]{a2 * 6, a2 << 1}, 0.0f);
            }
            case D: {
                return new BasicStroke(a2, 0, 2, 0.0f, new float[]{a2 * 12, a2 << 2}, 0.0f);
            }
            case b: {
                return new BasicStroke(a2, 0, 2, 0.0f, new float[]{a2, a2, 5 * a2, a2}, 0.0f);
            }
            case C: {
                return new BasicStroke(a2, 0, 2, 0.0f, new float[]{a2}, 0.0f);
            }
        }
        return new BasicStroke(a2);
    }

    public ac_0() {
        ac_0 a2;
    }

    public static IndicatorLineStyle velox_api_layer1_messages_indicators_IndicatorLineStyle_E(int a2, eb_1 a3) {
        switch (a3) {
            case M: {
                int n2 = a2;
                return new IndicatorLineStyle(-1, 1, n2, -256, 1, n2);
            }
            case A: {
                int n3 = a2;
                return new IndicatorLineStyle(-772, (short)a2, n3, -772, (short)a2, n3);
            }
            case D: {
                int n4 = a2;
                return new IndicatorLineStyle(-16, (short)a2, n4, -16, (short)a2, n4);
            }
            case b: {
                int n5 = a2;
                return new IndicatorLineStyle(-1286, (short)a2, n5, -1286, (short)a2, n5);
            }
            case C: {
                int n6 = a2;
                return new IndicatorLineStyle(21845, (short)a2, n6, 21845, (short)a2, n6);
            }
        }
        int n7 = a2;
        return new IndicatorLineStyle(-1, 1, n7, -256, 1, n7);
    }
}

