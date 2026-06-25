import sqlite3
from datetime import datetime, timezone

conn = sqlite3.connect("data/app.sqlite")
# Look for bars around 01:00 or 13:00 UTC
rows = conn.execute("SELECT time, open, high, low, close, volume FROM bars WHERE timeframe='1m' ORDER BY time DESC LIMIT 2000").fetchall()
for r in rows:
    dt = datetime.fromtimestamp(r[0]/1000, tz=timezone.utc)
    if dt.hour in (1, 13) and dt.minute in (0, 1):
        print(f"Bar Time: {r[0]} ({dt.strftime('%Y-%m-%d %H:%M:%S')} UTC) - O:{r[1]} H:{r[2]} L:{r[3]} C:{r[4]} V:{r[5]}")
conn.close()
