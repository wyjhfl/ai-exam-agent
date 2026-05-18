import sqlite3

db_path = r"E:\githubshizhanxiangmu666\AI全栈开发\ai-exam-agent\data\ai_exam_agent.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print("Tables:", tables)

cursor.execute("PRAGMA table_info(users)")
cols = cursor.fetchall()
print("\nUsers columns:")
for c in cols:
    print(f"  {c[1]} {c[2]}")

alter_statements = [
    "ALTER TABLE users ADD COLUMN password_hash VARCHAR(128)",
    "ALTER TABLE wrong_questions ADD COLUMN easiness_factor FLOAT DEFAULT 2.5",
    "ALTER TABLE wrong_questions ADD COLUMN interval INTEGER DEFAULT 1",
    "ALTER TABLE wrong_questions ADD COLUMN next_review_at DATETIME",
]

for stmt in alter_statements:
    try:
        cursor.execute(stmt)
        print(f"OK: {stmt}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"SKIP (exists): {stmt}")
        else:
            print(f"ERROR: {stmt} -> {e}")

conn.commit()
conn.close()
print("\nDone!")
