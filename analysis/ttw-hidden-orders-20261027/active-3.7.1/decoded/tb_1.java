/*
 * Decompiled with CFR 0.152.
 */
package ttw.tradefinder;

import ttw.tradefinder.qc_1;

/*
 * Renamed from ttw.tradefinder.tB
 */
public class tb_1
implements Runnable {
    public final /* synthetic */ qc_1 b;
    public final /* synthetic */ String c;

    /*
     * Ignored method signature, as it can't be verified against descriptor
     */
    public /* synthetic */ tb_1(qc_1 a2, String a3) {
        tb_1 a4;
        a4.b = a2;
        a4.c = a3;
    }

    @Override
    public /* synthetic */ void run() {
        tb_1 a2;
        a2.b.d.setText(a2.c);
    }
}

