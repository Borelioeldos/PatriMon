"""
PatriMon — Service de synchronisation automatique et périodique des comptes (Phase 3).
Exécute la synchronisation en arrière-plan à intervalle régulier (soldes + transactions),
sans aucune intervention manuelle nécessaire.
"""
import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

from sqlmodel import Session
from app.database import engine
from app.config import SYNC_SCHEDULER_CONFIG_PATH, BASE_DIR

logger = logging.getLogger("sync_scheduler_service")

CONFIG_PATH = SYNC_SCHEDULER_CONFIG_PATH


class SyncSchedulerService:
    def __init__(self):
        self.enabled: bool = True
        self.interval_minutes: int = 240  # 4 heures par défaut
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.last_status: str = "idle"  # "idle", "running", "success", "error"
        self.last_summary: Optional[Dict[str, Any]] = None
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._load_config()

    def _load_config(self):
        """Charge la configuration depuis sync_scheduler_config.json si existant."""
        legacy_path = BASE_DIR / "sync_scheduler_config.json"
        if not CONFIG_PATH.exists() and legacy_path.exists() and CONFIG_PATH != legacy_path:
            try:
                import shutil
                shutil.copy2(legacy_path, CONFIG_PATH)
                logger.info(f"Migration de configuration scheduler: {legacy_path} -> {CONFIG_PATH}")
            except Exception as e:
                logger.warning(f"Impossible de migrer {legacy_path}: {e}")

        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.enabled = cfg.get("enabled", self.enabled)
                    self.interval_minutes = int(cfg.get("interval_minutes", self.interval_minutes))
                    if cfg.get("last_run"):
                        try:
                            self.last_run = datetime.fromisoformat(cfg["last_run"])
                        except Exception:
                            pass
                    if cfg.get("next_run"):
                        try:
                            self.next_run = datetime.fromisoformat(cfg["next_run"])
                        except Exception:
                            pass
                    self.last_status = cfg.get("last_status", self.last_status)
                    self.last_summary = cfg.get("last_summary", self.last_summary)
            except Exception as e:
                logger.warning(f"Impossible de charger sync_scheduler_config.json: {e}")

    def _save_config(self):
        """Sauvegarde l'état actuel de la planification."""
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({
                    "enabled": self.enabled,
                    "interval_minutes": self.interval_minutes,
                    "last_run": self.last_run.isoformat() if self.last_run else None,
                    "next_run": self.next_run.isoformat() if self.next_run else None,
                    "last_status": self.last_status,
                    "last_summary": self.last_summary,
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Impossible de sauvegarder sync_scheduler_config.json: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Retourne l'état complet du planificateur de synchronisation."""
        now = datetime.now(timezone.utc)
        time_until_next = None
        if self.next_run and self.next_run > now:
            diff_seconds = int((self.next_run - now).total_seconds())
            hours, remainder = divmod(diff_seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            time_until_next = f"{hours}h {minutes}min" if hours > 0 else f"{minutes} min"

        return {
            "enabled": self.enabled,
            "interval_minutes": self.interval_minutes,
            "interval_label": self._format_interval_label(self.interval_minutes),
            "is_running": self._is_running,
            "last_run": self.last_run.strftime("%d/%m/%Y %H:%M:%S") if self.last_run else None,
            "next_run": self.next_run.strftime("%d/%m/%Y %H:%M:%S") if self.next_run else None,
            "time_until_next": time_until_next,
            "last_status": self.last_status,
            "last_summary": self.last_summary,
        }

    @staticmethod
    def _format_interval_label(minutes: int) -> str:
        if minutes < 60:
            return f"Toutes les {minutes} minutes"
        hours = minutes // 60
        if hours == 1:
            return "Toutes les heures"
        elif hours == 24:
            return "Une fois par jour (24h)"
        return f"Toutes les {hours} heures"

    def update_config(
        self, 
        enabled: Optional[bool] = None, 
        interval_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        """Met à jour les paramètres de synchronisation automatique."""
        if enabled is not None:
            self.enabled = bool(enabled)
        if interval_minutes is not None and interval_minutes > 0:
            self.interval_minutes = int(interval_minutes)

        # Recalcul de la prochaine exécution
        if self.enabled:
            now = datetime.now(timezone.utc)
            self.next_run = now + timedelta(minutes=self.interval_minutes)
        else:
            self.next_run = None

        self._save_config()
        logger.info(f"Planification synchro mise à jour : actif={self.enabled}, intervalle={self.interval_minutes}min")
        return self.get_status()

    async def execute_sync_now(self) -> Dict[str, Any]:
        """Exécute immédiatement la synchronisation complète (soldes + transactions + snapshot)."""
        from app.services.open_banking_service import open_banking_service
        from app.services.portfolio_service import portfolio_service

        logger.info("Démarrage d'un cycle de synchronisation automatique...")
        self.last_status = "running"

        start_time = datetime.now(timezone.utc)
        result = {}

        try:
            with Session(engine) as session:
                # 1. Synchronisation des soldes et transactions
                sync_res = await open_banking_service.sync_all_balances(session)

                # 2. Création ou mise à jour du snapshot de patrimoine du jour (non bloquant R3)
                try:
                    def _take_snapshot():
                        with Session(engine) as snap_session:
                            portfolio_service.get_portfolio_summary(
                                snap_session, force_refresh=True, record_snapshot=True
                            )

                    await asyncio.to_thread(_take_snapshot)
                except Exception as e:
                    logger.warning(f"Note snapshot patrimoine : {e}")


                result = {
                    "success": True,
                    "accounts_synced": sync_res.get("synced_accounts_count", 0),
                    "total_balance_synced": sync_res.get("total_balance_synced", 0.0),
                    "transactions_new": sync_res.get("new_transactions_imported", 0),
                    "synced_at": start_time.strftime("%d/%m/%Y %H:%M:%S"),
                }

                self.last_status = "success"
                self.last_run = start_time
                self.next_run = start_time + timedelta(minutes=self.interval_minutes)
                self.last_summary = result
                self._save_config()
                logger.info(f"Cycle de synchronisation automatique terminé avec succès : {result}")

        except Exception as e:
            logger.error(f"Échec du cycle de synchronisation automatique : {e}", exc_info=True)
            self.last_status = "error"
            self.last_run = start_time
            self.next_run = start_time + timedelta(minutes=max(15, self.interval_minutes // 4))  # réessai plus rapide en cas d'erreur
            self.last_summary = {"error": str(e), "synced_at": start_time.strftime("%d/%m/%Y %H:%M:%S")}
            self._save_config()
            result = {"success": False, "error": str(e)}

        return result

    async def _loop(self):
        """Boucle asynchrone permanente en arrière-plan."""
        self._is_running = True
        logger.info("Boucle de synchronisation automatique démarrée.")

        # Calculer le premier next_run si absent
        if not self.next_run:
            self.next_run = datetime.now(timezone.utc) + timedelta(minutes=self.interval_minutes)
            self._save_config()

        while self._is_running:
            try:
                if self.enabled:
                    now = datetime.now(timezone.utc)
                    if self.next_run and now >= self.next_run:
                        await self.execute_sync_now()

                # Attente par palier de 10 secondes (permet un arrêt réactif)
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Erreur inattendue dans la boucle de synchronisation: {e}")
                await asyncio.sleep(30)

        self._is_running = False
        logger.info("Boucle de synchronisation automatique arrêtée.")

    def start(self):
        """Démarre le planificateur de tâches en tâche de fond FastAPI."""
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        """Arrête proprement le planificateur."""
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()


sync_scheduler_service = SyncSchedulerService()
