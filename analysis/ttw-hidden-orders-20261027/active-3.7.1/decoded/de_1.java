/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  oshi.SystemInfo
 *  oshi.hardware.CentralProcessor
 *  oshi.hardware.GraphicsCard
 *  oshi.software.os.OperatingSystem
 */
package ttw.tradefinder;

import java.text.DecimalFormat;
import java.util.LinkedHashMap;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.GraphicsCard;
import oshi.software.os.OperatingSystem;
import ttw.tradefinder.cc_0;
import ttw.tradefinder.sf_0;

/*
 * Renamed from ttw.tradefinder.De
 */
public class de_1 {
    private static DecimalFormat c = new DecimalFormat("0.#");

    public static LinkedHashMap<String, String> E() {
        Object object = new SystemInfo();
        OperatingSystem operatingSystem = object.getOperatingSystem();
        object = object.getHardware();
        LinkedHashMap<String, String> linkedHashMap = new LinkedHashMap<String, String>();
        linkedHashMap.put("OS", operatingSystem.toString());
        linkedHashMap.put("MEM", de_1.E(object.getMemory().getTotal()));
        linkedHashMap.put("PROC", String.valueOf(object.getProcessor().getProcessorIdentifier().getName()));
        int n2 = 1;
        object = object.getGraphicsCards().iterator();
        Object object2 = object;
        while (object2.hasNext()) {
            GraphicsCard graphicsCard = (GraphicsCard)object.next();
            String string = "GRAPHICS " + n2;
            ++n2;
            linkedHashMap.put(string, graphicsCard.getName() + ", " + de_1.E(graphicsCard.getVRam()));
            object2 = object;
        }
        return linkedHashMap;
    }

    private static /* synthetic */ String E(long a2) {
        double d2;
        double d3 = (double)a2 / 1.073741824E9;
        if (d2 > 1.0) {
            return c.format(d3) + " GiB";
        }
        d3 = (double)a2 / 1048576.0;
        return c.format(d3) + " MiB";
    }

    public static String E() {
        try {
            SystemInfo systemInfo = new SystemInfo();
            OperatingSystem operatingSystem = systemInfo.getOperatingSystem();
            systemInfo = systemInfo.getHardware();
            CentralProcessor centralProcessor = systemInfo.getProcessor();
            systemInfo = systemInfo.getComputerSystem();
            return String.join((CharSequence)"#", operatingSystem.getManufacturer(), systemInfo.getBaseboard().getSerialNumber(), systemInfo.getSerialNumber(), centralProcessor.getProcessorIdentifier().getProcessorID(), centralProcessor.getProcessorIdentifier().getIdentifier());
        }
        catch (Exception exception) {
            return "";
        }
    }

    public de_1() {
        de_1 a2;
    }
}

