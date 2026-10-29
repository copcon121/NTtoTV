/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  org.apache.commons.lang3.tuple.Triple
 */
package ttw.tradefinder;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import org.apache.commons.lang3.tuple.Triple;
import ttw.tradefinder.KB;

/*
 * Renamed from ttw.tradefinder.QA
 */
public class qa_2
extends KB {
    private final Color C;
    private final Triple<Integer, Integer, Integer> M;
    private final Font b;
    private final String c;

    public void j(int a2, int a3, int a4, Graphics2D a5) {
        qa_2 a6;
        Graphics2D graphics2D = a5;
        qa_2 qa_22 = a6;
        a5.setFont(qa_22.b);
        graphics2D.setColor(qa_22.C);
        graphics2D.drawString(a6.c, a2 + a4 - (Integer)a6.M.getLeft(), a3 + (Integer)a6.M.getRight());
    }

    public qa_2(String a2, Font a3, Color a4) {
        qa_2 a5;
        a5.C = a4;
        a5.c = a2;
        a5.b = a3;
        a5.M = a5.E(a3, a2);
    }

    public void E(int a2, int a3, Graphics2D a4) {
        qa_2 a5;
        Graphics2D graphics2D = a4;
        qa_2 qa_22 = a5;
        a4.setFont(qa_22.b);
        graphics2D.setColor(qa_22.C);
        graphics2D.drawString(a5.c, a2, a3 + (Integer)a5.M.getRight());
    }

    public void E(int a2, int a3, int a4, Graphics2D a5) {
        qa_2 a6;
        Graphics2D graphics2D = a5;
        qa_2 qa_22 = a6;
        a5.setFont(qa_22.b);
        graphics2D.setColor(qa_22.C);
        graphics2D.drawString(a6.c, a2 + (a4 - (Integer)a6.M.getLeft()) / 2, a3 + (Integer)a6.M.getRight());
    }

    public int j() {
        qa_2 a2;
        return (Integer)a2.M.getLeft();
    }

    public int E() {
        qa_2 a2;
        return (Integer)a2.M.getMiddle();
    }
}

