/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  velox.api.layer1.annotations.Layer1ApiVersion
 *  velox.api.layer1.annotations.Layer1ApiVersionValue
 *  velox.api.layer1.annotations.Layer1SimpleAttachable
 *  velox.api.layer1.annotations.Layer1StrategyDateLicensed
 *  velox.api.layer1.annotations.Layer1StrategyName
 *  velox.api.layer1.annotations.UnrestrictedData
 *  velox.api.layer1.data.InstrumentInfo
 *  velox.api.layer1.simplified.NoAutosubscription
 */
package velox.indicators.sionchart;

import com.bookmap.a.a.a.a;
import java.util.Arrays;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyDateLicensed;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.annotations.UnrestrictedData;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.simplified.NoAutosubscription;
import velox.indicators.sionchart.b.s;
import velox.indicators.sionchart.g;
import velox.indicators.sionchart.h;
import velox.indicators.sionchart.l;
import velox.indicators.sionchart.m;

@UnrestrictedData
@NoAutosubscription
@Layer1SimpleAttachable
@Layer1StrategyName(value="Stops&Icebergs On-Chart")
@Layer1StrategyDateLicensed(value="BM.Indicators.IcebergsTracker")
@Layer1ApiVersion(value=Layer1ApiVersionValue.VERSION2)
public class SitIndicator
extends m {
    public static final String B = "Stops&Icebergs On-Chart";
    public static final String C = "si-onchart";
    private final g D = new g();

    @Override
    public String e() {
        return B;
    }

    @Override
    public String f() {
        return C;
    }

    @Override
    public Object g() {
        return new SitIndicator();
    }

    @Override
    protected boolean a(String string, InstrumentInfo instrumentInfo) {
        if (instrumentInfo.type != null) {
            String[] stringArray;
            for (String string2 : stringArray = instrumentInfo.type.split("@")) {
                if (!"RITHMIC".equals(string2) && !"DXFEED".equals(string2) && (!"EXT:com.bookmap.datadelivery.client.BookmapDataProvider".equals(string2) && !"EXT:com.bookmap.datadelivery.client.BookmapDataBetaProvider".equals(string2) || !"CME".equals(instrumentInfo.exchange) && !"CBOT".equals(instrumentInfo.exchange) && !"COMEX".equals(instrumentInfo.exchange) && !"NYMEX".equals(instrumentInfo.exchange))) continue;
                return true;
            }
        }
        return false;
    }

    @Override
    protected void a(s s2) {
        this.o = new h(this);
        a a2 = new a();
        a2.a(this::b);
        s2.b.addAll(Arrays.asList(this.D, this.o, a2));
        s2.c.addAll(Arrays.asList(this.D, this.o, a2));
        s2.a.addAll(Arrays.asList(this.D, this.o));
        if (this.x) {
            a2.b(this::a);
            s2.c.add(this.p);
            s2.a.add(this.p);
            s2.d.add(a2);
        }
    }

    @Override
    protected byte[] i() {
        return new byte[]{74, 108, 76, 116, 118, 86, 52, 102, 85, 107, 120, 70, 102, 81, 84, 116, 87, 83, 88, 78};
    }

    @Override
    protected byte[] j() {
        return new byte[]{-84, -19, 0, 5, 115, 114, 0, 20, 106, 97, 118, 97, 46, 115, 101, 99, 117, 114, 105, 116, 121, 46, 75, 101, 121, 82, 101, 112, -67, -7, 79, -77, -120, -102, -91, 67, 2, 0, 4, 76, 0, 9, 97, 108, 103, 111, 114, 105, 116, 104, 109, 116, 0, 18, 76, 106, 97, 118, 97, 47, 108, 97, 110, 103, 47, 83, 116, 114, 105, 110, 103, 59, 91, 0, 7, 101, 110, 99, 111, 100, 101, 100, 116, 0, 2, 91, 66, 76, 0, 6, 102, 111, 114, 109, 97, 116, 113, 0, 126, 0, 1, 76, 0, 4, 116, 121, 112, 101, 116, 0, 27, 76, 106, 97, 118, 97, 47, 115, 101, 99, 117, 114, 105, 116, 121, 47, 75, 101, 121, 82, 101, 112, 36, 84, 121, 112, 101, 59, 120, 112, 116, 0, 3, 82, 83, 65, 117, 114, 0, 2, 91, 66, -84, -13, 23, -8, 6, 8, 84, -32, 2, 0, 0, 120, 112, 0, 0, 2, 38, 48, -126, 2, 34, 48, 13, 6, 9, 42, -122, 72, -122, -9, 13, 1, 1, 1, 5, 0, 3, -126, 2, 15, 0, 48, -126, 2, 10, 2, -126, 2, 1, 0, -69, -72, -120, -98, 116, -29, -90, -6, 21, -40, -75, 8, -76, -14, -101, -80, 40, 38, -45, -10, 49, -54, 27, -8, 46, 46, -109, -117, 69, -34, -111, -100, 18, -13, 25, 91, -121, -55, -55, 95, 49, 9, 75, -46, -56, 23, 81, 46, -91, 14, -87, 94, 10, -106, -59, -15, 46, -77, -20, -120, 125, -97, 108, 44, -99, -60, 77, 90, 24, -44, -5, -127, -72, 104, -7, -77, -113, -93, -119, -60, 82, -66, -125, -5, -63, 80, 118, 8, -5, -16, 84, -58, -86, 3, 7, -41, 48, -63, -95, 10, -74, 106, 59, -15, -43, 31, 24, -22, 41, -66, 87, -58, 51, -16, -38, -38, -41, -42, -51, 46, -27, 89, 1, -127, 35, 7, -40, 0, -128, 127, 118, 23, -99, 52, -126, 7, -113, 50, 67, 30, 45, -92, 49, 95, 32, -114, 91, -103, -20, -100, 105, 4, 46, -91, 126, 94, 2, -13, 22, -70, 2, 73, 58, -107, -18, -83, -128, 19, 37, 24, 17, -68, 109, 35, 17, 21, 20, -87, 109, 2, 49, 123, -20, 15, 99, 110, -28, -54, -78, 3, -74, 63, -121, -66, -26, -96, 48, 27, -76, -52, 117, -119, -7, -112, -80, 91, -26, -124, -34, -34, 47, -109, 117, 66, 51, 101, 13, -126, 36, -77, -8, 58, 78, 52, -113, 28, 105, -67, -107, 12, 103, -34, 70, 53, -88, -81, 70, -27, -46, 88, -90, 58, -25, -55, -101, -34, 51, 54, -18, -69, 120, -76, 119, -78, 48, 111, 47, 25, -5, 87, -99, 37, 117, -119, -33, 64, -77, 61, 61, -18, 117, 95, -72, 88, -49, 55, -5, -83, 38, -69, 118, 104, 81, -104, 121, 74, 17, 33, 47, 126, -4, -122, 62, 77, 78, -42, -127, 37, -126, -55, -8, -127, 46, -18, -80, 25, -48, -64, -64, -48, 121, 26, -29, 110, 16, -26, -63, -99, 45, 113, 72, 99, 24, -9, 27, 8, -62, 25, -27, 102, 61, -120, -80, 60, -46, 115, 49, 125, 38, -115, 74, -13, -128, 10, -60, -127, -52, -107, 65, 99, -61, 57, 95, 18, -35, -92, 109, 9, 111, -38, 87, 50, 16, 12, 68, 39, 59, 14, -95, 29, 15, 19, -61, -42, -44, 56, -81, -44, 76, 86, -78, 85, -94, 16, 49, -64, 114, -88, -44, -82, -43, -115, -79, -87, 106, -63, 105, 3, -109, -34, 17, 1, -95, 40, -120, -119, 109, -3, 31, 96, -28, -32, 112, -59, -11, 65, 21, -79, -55, 89, -24, -104, -43, 82, -95, 50, 24, -118, -109, -88, 111, -28, -20, -3, -19, 61, -35, 93, -46, -52, -87, 112, -63, 45, 41, -13, 50, -68, 65, -30, 115, 34, 59, -101, -9, 24, -25, 37, -108, -26, 47, -5, -41, -108, 36, 22, 115, 72, -2, -36, -49, 32, 46, -98, 34, -50, -114, -76, -123, -121, 87, -42, 49, 26, 47, -71, 35, -38, -81, -121, -43, 12, 115, -47, 119, -17, -47, 116, -95, 80, 43, -36, -125, -78, 35, -27, 24, -42, 66, 125, -4, -115, 2, 3, 1, 0, 1, 116, 0, 5, 88, 46, 53, 48, 57, 126, 114, 0, 25, 106, 97, 118, 97, 46, 115, 101, 99, 117, 114, 105, 116, 121, 46, 75, 101, 121, 82, 101, 112, 36, 84, 121, 112, 101, 0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 120, 114, 0, 14, 106, 97, 118, 97, 46, 108, 97, 110, 103, 46, 69, 110, 117, 109, 0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 120, 112, 116, 0, 6, 80, 85, 66, 76, 73, 67};
    }

    @Override
    protected byte[] k() {
        return new byte[]{83, 84, 82, 65, 84, 69, 71, 89, 46, 66, 77, 46, 73, 110, 100, 105, 99, 97, 116, 111, 114, 115, 46, 73, 99, 101, 98, 101, 114, 103, 115, 84, 114, 97, 99, 107, 101, 114};
    }

    @Override
    protected byte[] l() {
        return new byte[]{83, 84, 82, 65, 84, 69, 71, 89, 46, 66, 77, 46, 73, 110, 100, 105, 99, 97, 116, 111, 114, 115, 46, 73, 99, 101, 98, 101, 114, 103, 115, 84, 114, 97, 99, 107, 101, 114, 46, 67, 111, 100, 101, 49, 48, 50};
    }

    @Override
    protected byte[] m() {
        return new byte[]{83, 84, 82, 65, 84, 69, 71, 89, 46, 66, 77, 46, 73, 110, 100, 105, 99, 97, 116, 111, 114, 115, 46, 73, 99, 101, 98, 101, 114, 103, 115, 84, 114, 97, 99, 107, 101, 114, 46, 66, 114, 65, 80, 73};
    }

    @Override
    protected byte[] n() {
        return new byte[]{83, 116, 111, 112, 115, 38, 73, 99, 101, 98, 101, 114, 103, 115, 32, 79, 110, 45, 67, 104, 97, 114, 116};
    }

    @Override
    protected byte[] o() {
        return new byte[]{115, 105, 45, 111, 110, 99, 104, 97, 114, 116};
    }

    private void b(String string) {
        l l2 = (l)this.D.e.get(string);
        if (l2 != null) {
            this.o.a(l2);
        }
    }
}

