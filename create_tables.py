from backend.database import engine, Base
from backend.db_models import User, File

print("Creating database tables...")

Base.metadata.create_all(bind=engine)

print("✅ Tables created successfully!")
print("\nTables created:")
print("- users")
print("- files")