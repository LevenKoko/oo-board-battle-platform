import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 从环境变量获取数据库连接字符串，如果不存在则使用本地默认值 (Docker中会设置环境变量)
# 在 Docker Compose 中，主机名将是 'db' 而不是 'localhost'
DEFAULT_DB_URL = "mysql+pymysql://board_game:YOURPASSWORD@localhost/YOUEUSERNAME"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# 创建 SQLAlchemy 引擎
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    echo=True # Set to False in production for less logging
)

# 每个 SessionLocal 实例都是一个数据库会话
# 当我们使用它时，它将是独立的
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 我们将继承这个 Base 类来创建每个数据库模型
Base = declarative_base()

# 依赖项
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
