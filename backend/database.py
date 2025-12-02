from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 从环境变量或配置文件中获取数据库连接字符串
# 建议在生产环境中使用环境变量或更安全的配置管理
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://board_game:998244353@localhost/board_battle_db" 

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
