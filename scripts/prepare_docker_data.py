"""
PatriMon — Script de Préparation et d'Exportation des Données pour Docker & Home Assistant OS.

Ce script regroupe en 1 clic l'ensemble de vos données existantes (base SQLite, configurations
Open Banking, clés RSA, planificateur, stratégie) dans un dossier 'data/' à la racine du projet.

Utilisation :
    python scripts/prepare_docker_data.py
"""
import shutil
from pathlib import Path

# Répertoires
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
TARGET_DATA_DIR = ROOT_DIR / "data"


def main():
    print("=" * 65)
    print(" PatriMon — Préparation du Dossier de Données (/data)")
    print("=" * 65)

    TARGET_DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[+] Dossier cible : {TARGET_DATA_DIR.resolve()}\n")

    items_to_copy = [
        ("Base de données SQLite", BACKEND_DIR / "patrimoines.db", TARGET_DATA_DIR / "patrimoines.db"),
        ("Config Open Banking DSP2", BACKEND_DIR / "open_banking_config.json", TARGET_DATA_DIR / "open_banking_config.json"),
        ("Config Stratégie & Allocation", BACKEND_DIR / "strategy_config.json", TARGET_DATA_DIR / "strategy_config.json"),
        ("Config Planificateur Synchro", BACKEND_DIR / "sync_scheduler_config.json", TARGET_DATA_DIR / "sync_scheduler_config.json"),
    ]

    copied_count = 0
    for label, src, dst in items_to_copy:
        if src.exists():
            shutil.copy2(src, dst)
            size_kb = src.stat().st_size / 1024
            print(f"  [OK] {label:<32} -> {dst.name} ({size_kb:.1f} Ko)")
            copied_count += 1
        else:
            print(f"  [--] {label:<32} : Aucun fichier existant (sera créé au démarrage)")

    # Copie du dossier certs/ si existant
    certs_src = BACKEND_DIR / "certs"
    certs_dst = TARGET_DATA_DIR / "certs"
    if certs_src.exists() and certs_src.is_dir():
        certs_dst.mkdir(parents=True, exist_ok=True)
        cert_files = list(certs_src.glob("*.pem"))
        for cf in cert_files:
            shutil.copy2(cf, certs_dst / cf.name)
        print(f"  [OK] Clés RSA ({len(cert_files)} fichiers .pem)            -> certs/")
        copied_count += 1

    print("\n" + "-" * 65)
    print(f" Résumé : {copied_count} élément(s) exporté(s) dans ./data/")
    print("-" * 65)
    print("\nPour transférer vos données sur votre vieux PC sous Home Assistant OS :")
    print("  1. Connectez-vous à Home Assistant (via Samba share, SSH ou l'explorateur).")
    print("  2. Déposez le contenu de ce dossier dans le volume /data de l'add-on")
    print("     ou montez le dossier ./data:/data dans votre docker-compose.")
    print("  3. Lancez PatriMon : vous retrouverez instantanément tous vos comptes,")
    print("     transactions, configurations et clés sans aucune ressaisie !")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
