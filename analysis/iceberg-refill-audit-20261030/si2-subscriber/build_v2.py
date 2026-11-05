"""Immutable V2 build: freezes the reviewed V1 source and changes DTO reading only."""
import hashlib
import json
from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
BOOKMAP = Path("C:/Program Files/Bookmap")
SI = Path("C:/Bookmap/API/Layer1ApiModules/7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar")
EXPECTED = "317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab"
assert hashlib.sha256(SI.read_bytes()).hexdigest() == EXPECTED
source = HERE / "src/com/nttotv/diagnostics/Si2DiagnosticCapture.java"
assert hashlib.sha256(source.read_bytes()).hexdigest() == "352f48a72b3502a0ece89f9fb44847bf709b8da7274c5d4c695574ac6bb5a735"
text = source.read_text(encoding="utf-8")
text = text.replace("Si2DiagnosticCapture", "Si2DiagnosticCaptureV2")
text = text.replace("NTtoTV SI2 Diagnostic Capture", "NTtoTV SI2 Diagnostic Capture V2")
text = text.replace("MINUTES.toNanos(30)", "MINUTES.toNanos(90)")
text = text.replace('\\"lookbackMinutes\\":30', '\\"lookbackMinutes\\":90')
text = text.replace('"si2-" + Instant.now()', '"si2-v2-" + Instant.now()')
start = text.index("    private void recordEvent(")
end = text.index("    static String eventJson(", start)
text = text[:start] + '''    void recordEvent(String capture, String generator, Object value) {
        try {
            EventInterface event = Si2PublicEventReader.read(value);
            if (event.getType() == EventType.STOP) return;
            enqueue(eventJson(capture, generator, alias, tickSize, event));
        } catch (ReflectiveOperationException | IllegalArgumentException error) {
            enqueue("{\\\"kind\\\":\\\"unsupported_event_class\\\",\\\"class\\\":"
                + quote(value == null ? "null" : value.getClass().getName())
                + ",\\\"errorClass\\\":" + quote(error.getClass().getName()) + "}");
        }
    }

    int pendingLines() { return lines.size(); }

''' + text[end:]
generated = HERE / "build-v2/generated-src/com/nttotv/diagnostics/Si2DiagnosticCaptureV2.java"
generated.parent.mkdir(parents=True, exist_ok=True)
generated.write_text(text, encoding="utf-8")
classes = HERE / "build-v2/classes"
classes.mkdir(parents=True, exist_ok=True)
classpath = ";".join(map(str, [SI, BOOKMAP / "lib/bm-l1api.jar", BOOKMAP / "lib/bm-simplified-api-wrapper.jar"]))
sources = [generated, HERE / "src/com/nttotv/diagnostics/Si2PublicEventReader.java",
    HERE / "src/com/nttotv/diagnostics/Si2CrossLoaderTest.java"]
subprocess.run([str(BOOKMAP / "jre/bin/javac.exe"), "-encoding", "UTF-8", "-source", "17",
    "-target", "17", "-cp", classpath, "-d", str(classes), *map(str, sources)], check=True)
test = subprocess.run([str(BOOKMAP / "jre/bin/java.exe"), "-cp", str(classes) + ";" + classpath,
    "com.nttotv.diagnostics.Si2CrossLoaderTest", str(SI)], check=True, text=True, capture_output=True)
json.loads(test.stdout.splitlines()[-1])
(HERE / "build-v2/cross-loader-test.txt").write_text(test.stdout, encoding="utf-8")
out = HERE / "NTtoTV-SI2-Diagnostic-Capture-v2.jar"
if out.exists():
    raise SystemExit("Immutable v2 artifact exists; choose a new revision filename before rebuilding")
prefixes = ("com/bookmap/addons/broadcasting/", "velox/indicators/sionchart/broadcasting/",
    "org/nustaq/", "org/objenesis/", "org/reflections/", "javassist/", "javax/annotation/", "com/fasterxml/")
with ZipFile(out, "w", compression=ZIP_DEFLATED) as target, ZipFile(SI) as original:
    target.writestr("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\r\n\r\n")
    for member in original.infolist():
        if not member.is_dir() and member.filename.startswith(prefixes):
            target.writestr(member.filename, original.read(member.filename))
    for path in classes.rglob("*.class"):
        if "Test" not in path.name:
            target.write(path, path.relative_to(classes).as_posix())
summary = {"jar": str(out), "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
    "originalSiSha256": EXPECTED, "lookbackMinutes": 90,
    "crossLoaderTest": "passed", "runtimeLoaded": False}
(HERE / "build-summary-v2.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(test.stdout, end="")
print(json.dumps(summary, indent=2))
