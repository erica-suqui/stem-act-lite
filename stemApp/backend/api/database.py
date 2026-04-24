from google.cloud.sql.connector import Connector
import sqlalchemy

def create_engine():
    connector = Connector()

    def getconn():
        conn = connector.connect(
            "storied-precept-491812-u8:us-east1:stemact-db",
            "pg8000",
            user="stemact-user",
            password=os.getenv("PASSWORD"),
            db="stemact-events",
        )
        return conn

    engine = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=getconn,
    )
    return engine
