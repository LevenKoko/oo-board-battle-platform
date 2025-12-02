from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from board_battle_project.backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    total_games = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches_as_black = relationship("Match", foreign_keys="[Match.player_black_id]", back_populates="player_black")
    matches_as_white = relationship("Match", foreign_keys="[Match.player_white_id]", back_populates="player_white")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    player_black_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Null if AI
    player_white_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Null if AI
    game_type = Column(String(20), nullable=False) # Store enum name as string
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    result = Column(String(20), nullable=True) # e.g., "BLACK_WON", "DRAW", "WHITE_WON"
    moves_json = Column(JSON, nullable=False) # Stores the list of moves as JSON

    player_black = relationship("User", foreign_keys=[player_black_id], back_populates="matches_as_black")
    player_white = relationship("User", foreign_keys=[player_white_id], back_populates="matches_as_white")

