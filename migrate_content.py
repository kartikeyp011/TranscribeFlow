import sys
import os
import json
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Ensure we can import from backend
sys.path.append(os.getcwd())
from backend.database import DATABASE_URL as SQLALCHEMY_DATABASE_URL

def migrate():
    print("🚀 Starting content migration...")
    
    # Create content directory
    CONTENT_DIR = "content_files"
    os.makedirs(CONTENT_DIR, exist_ok=True)
    print(f"📂 ensured {CONTENT_DIR} exists")

    # Connect to DB
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 1. Add content_file column if it doesn't exist
        # Check if column exists first
        try:
            result = db.execute(text("SHOW COLUMNS FROM files LIKE 'content_file'"))
            if not result.fetchone():
                print("➕ Adding content_file column...")
                db.execute(text("ALTER TABLE files ADD COLUMN content_file VARCHAR(500)"))
                db.commit()
            else:
                print("ℹ️ content_file column already exists")
        except Exception as e:
            print(f"⚠️ Error checking/adding column: {e}")
            db.rollback()

        # 2. Fetch files that have data but no content_file
        # We use raw SQL because db_models.py no longer has these columns
        print("🔍 Scanning for files to migrate...")
        query = text("""
            SELECT id, transcript, summary, word_timestamps, speaker_segments 
            FROM files 
            WHERE is_deleted = 0 
            AND (content_file IS NULL OR content_file = '')
        """)
        
        # Check if the columns actually exist before trying to select them
        # If they were already dropped, this query will fail
        try:
            rows = db.execute(query).fetchall()
        except Exception as e:
            print("⚠️ Could not fetch old columns (maybe they are already dropped?)")
            print(f"Error: {e}")
            rows = []

        print(f"📦 Found {len(rows)} files to migrate.")

        migrated_count = 0
        for row in rows:
            file_id, transcript, summary, wt, ss = row
            
            # Skip if no content at all
            if not any([transcript, summary, wt, ss]):
                continue

            # Parse JSON strings safely
            wt_json = None
            if wt:
                try: 
                    wt_json = json.loads(wt) 
                except: 
                    wt_json = [] # fallback or keep as string? JSON format requires object/list
            
            ss_json = None
            if ss:
                try: 
                    ss_json = json.loads(ss) 
                except: 
                    ss_json = []

            # Prepare content data
            data = {
                "transcript": transcript,
                "summary": summary,
                "word_timestamps": wt_json,
                "speaker_segments": ss_json
            }

            # Generate filename and save
            filename = f"{uuid.uuid4()}.json"
            filepath = os.path.join(CONTENT_DIR, filename)
            
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                # Update DB
                db.execute(
                    text("UPDATE files SET content_file = :idx WHERE id = :mid"), 
                    {"idx": filename, "mid": file_id}
                )
                migrated_count += 1
                if migrated_count % 10 == 0:
                    print(f"   Migrated {migrated_count} files...")
            except Exception as e:
                print(f"❌ Failed to migrate file {file_id}: {e}")

        db.commit()
        print(f"✅ Successfully migrated {migrated_count} files.")

        # 3. Drop old columns
        # Ask user confirmation? No, user explicitly requested "mysql to not store... update... as per this change"
        print("🗑️ Dropping old TEXT columns from MySQL...")
        
        columns_to_drop = ["transcript", "summary", "word_timestamps", "speaker_segments"]
        dropped_count = 0
        for col in columns_to_drop:
            try:
                # Check if exists
                res = db.execute(text(f"SHOW COLUMNS FROM files LIKE '{col}'"))
                if res.fetchone():
                    db.execute(text(f"ALTER TABLE files DROP COLUMN {col}"))
                    dropped_count += 1
            except Exception as e:
                print(f"⚠️ Error dropping column {col}: {e}")
        
        db.commit()
        print(f"🎉 Migration complete. Dropped {dropped_count} columns.")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
