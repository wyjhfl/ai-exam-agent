import sqlite3, os, glob

db_files = glob.glob("data/**/*.db", recursive=True)
if not db_files:
    db_files = glob.glob("**/*.db", recursive=True)

print("Found DB files:", db_files)

for db_path in db_files[:3]:
    print(f"\n=== {db_path} ===")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("Tables:", [t[0] for t in tables])
    for t in tables:
        cursor.execute(f"PRAGMA table_info({t[0]})")
        cols = cursor.fetchall()
        print(f"\n  {t[0]}:")
        for c in cols:
            print(f"    {c[1]} {c[2]} {'PK' if c[5] else ''}")
    conn.close()
