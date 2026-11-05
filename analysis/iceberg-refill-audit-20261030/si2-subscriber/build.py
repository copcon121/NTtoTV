"""Build a local-only normal addon; never deploy or load it into Bookmap."""
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
classes = HERE / "build/classes"
classes.mkdir(parents=True, exist_ok=True)
classpath = ";".join(map(str, [SI, BOOKMAP / "lib/bm-l1api.jar",
    BOOKMAP / "lib/bm-simplified-api-wrapper.jar"]))
sources = [str(path) for path in (HERE / "src").rglob("*.java")]
subprocess.run([str(BOOKMAP / "jre/bin/javac.exe"), "-encoding", "UTF-8",
    "-source", "17", "-target", "17", "-cp", classpath, "-d", str(classes), *sources], check=True)
test = subprocess.run([str(BOOKMAP / "jre/bin/java.exe"), "-cp",
    str(classes) + ";" + classpath, "com.nttotv.diagnostics.Si2CaptureFormatTest"],
    check=True, text=True, capture_output=True)
json.loads(test.stdout)
out = HERE / "NTtoTV-SI2-Diagnostic-Capture.jar"
prefixes = ("com/bookmap/addons/broadcasting/", "velox/indicators/sionchart/broadcasting/",
    "org/nustaq/", "org/objenesis/", "org/reflections/", "javassist/",
    "javax/annotation/", "com/fasterxml/")
copied = 0
with ZipFile(out, "w", compression=ZIP_DEFLATED) as target, ZipFile(SI) as original:
    target.writestr("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\r\n\r\n")
    for member in original.infolist():
        if not member.is_dir() and member.filename.startswith(prefixes):
            target.writestr(member.filename, original.read(member.filename))
            copied += 1
    for path in classes.rglob("*.class"):
        if "Si2CaptureFormatTest" not in path.name:
            target.write(path, path.relative_to(classes).as_posix())
summary = {"jar": str(out), "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
    "originalSiSha256": EXPECTED, "copiedRuntimeMembers": copied,
    "offlineFormatCheck": "passed", "runtimeLoaded": False}
(HERE / "build-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2))
