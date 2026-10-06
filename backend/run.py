import uvicorn
from app.config import HOST, PORT, RELOAD

if __name__ == "__main__":
    print(f"Démarrage de l'API PatriMon sur http://{HOST}:{PORT} (reload={RELOAD})...")
    print(f"Documentation Swagger disponible sur http://localhost:{PORT}/docs")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=RELOAD)
