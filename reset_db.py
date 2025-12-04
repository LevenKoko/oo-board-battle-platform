from sqlalchemy import create_engine, text
from board_battle_project.backend.database import SQLALCHEMY_DATABASE_URL

def reset_matches_table():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Dropping matches table...")
        try:
            conn.execute(text("DROP TABLE matches"))
            print("Matches table dropped.")
        except Exception as e:
            print(f"Error dropping table (maybe it doesn't exist): {e}")
        
        # We don't need to recreate it manually here. 
        # The main app restart will trigger create_all which will recreate it with new schema.
        
if __name__ == "__main__":
    reset_matches_table()
