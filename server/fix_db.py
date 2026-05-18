import sqlite3

db_path = "data/ai_exam_agent.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

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
            print(f"SKIP (already exists): {stmt}")
        else:
            print(f"ERROR: {stmt} -> {e}")

conn.commit()
conn.close()
print("\nDone! Database schema updated.")
