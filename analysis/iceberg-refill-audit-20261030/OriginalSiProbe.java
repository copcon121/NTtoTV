import com.bookmap.a.a.a.a;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import velox.api.layer1.data.TradeInfo;

/** Offline calls into the original detector; no addon startup or connection. */
public class OriginalSiProbe {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        a detector = null;
        String line;
        String name = "";
        final int[] step = {0};
        List<String> detections = new ArrayList<>();
        while ((line = reader.readLine()) != null) {
            String[] fields = line.split("\t");
            if (fields[0].equals("case")) {
                name = fields[1];
                step[0] = 0;
                detections.clear();
                detector = new a();
                detector.a(id -> detections.add(step[0] + ":" + id));
            } else if (fields[0].equals("end")) {
                System.out.println(name + "\t" + String.join(",", detections));
            } else {
                step[0]++;
                String id = fields[1];
                int price = Integer.parseInt(fields[2]);
                int quantity = Integer.parseInt(fields[3]);
                boolean bid = fields[4].equals("buy");
                switch (fields[0]) {
                    case "new": detector.send(id, bid, price, quantity); break;
                    case "change": detector.replace(id, price, quantity); break;
                    case "delete": detector.cancel(id); break;
                    case "trade":
                        detector.onTrade(price, quantity,
                            new TradeInfo(false, bid, false, false, fields[5], id));
                        break;
                    default: throw new IllegalArgumentException(fields[0]);
                }
            }
        }
    }
}
