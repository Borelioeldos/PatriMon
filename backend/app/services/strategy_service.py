"""
Service de Pilotage Stratégique, Allocation Cible, Rééquilibrage Intelligent (DCA) et Projections Long Terme (FIRE).
"""
import json
import os
import math
from typing import Dict, List, Any, Optional
from sqlmodel import Session
from app.config import STRATEGY_CONFIG_PATH, BASE_DIR
from app.services.portfolio_service import portfolio_service

# Presets d'allocation d'actifs éprouvés
DEFAULT_PRESETS = {
    "balanced": {
        "id": "balanced",
        "name": "Équilibré (60 / 30 / 10)",
        "description": "55% Actions/ETF pour la croissance, 25% Livrets/Épargne de précaution, 15% PEE et 5% Crypto.",
        "allocations": {
            "Actions & ETF": 55.0,
            "Livrets & Épargne": 25.0,
            "Épargne Entreprise (PEE)": 15.0,
            "Crypto": 5.0,
        },
    },
    "dynamic": {
        "id": "dynamic",
        "name": "Offensif Dynamique (75 / 15 / 10)",
        "description": "Maximise l'appréciation du capital long terme avec 65% Actions/ETF, 10% Crypto, 15% Épargne et 10% PEE.",
        "allocations": {
            "Actions & ETF": 65.0,
            "Livrets & Épargne": 15.0,
            "Épargne Entreprise (PEE)": 10.0,
            "Crypto": 10.0,
        },
    },
    "all_weather": {
        "id": "all_weather",
        "name": "All-Weather / Résilient",
        "description": "Inspiré de Ray Dalio : équilibre entre croissance boursière, épargne sécuritaire et diversification.",
        "allocations": {
            "Actions & ETF": 40.0,
            "Livrets & Épargne": 35.0,
            "Épargne Entreprise (PEE)": 15.0,
            "Crypto": 10.0,
        },
    },
    "prudent": {
        "id": "prudent",
        "name": "Prudent / Sécurité Renforcée",
        "description": "Priorité absolue à la préservation du capital avec 50% en livrets et 30% en actions.",
        "allocations": {
            "Actions & ETF": 30.0,
            "Livrets & Épargne": 50.0,
            "Épargne Entreprise (PEE)": 15.0,
            "Crypto": 5.0,
        },
    },
}

DEFAULT_CONFIG = {
    "active_preset": "balanced",
    "target_allocations": DEFAULT_PRESETS["balanced"]["allocations"],
    "fire_settings": {
        "desired_monthly_expense": 2500.0,
        "swr_pct": 4.0,
        "expected_return_pct": 7.0,
        "expected_inflation_pct": 2.0,
        "monthly_contribution": 500.0,
    }
}


class StrategyService:

    @classmethod
    def load_config(cls) -> Dict[str, Any]:
        """Charge la configuration stratégique depuis le fichier JSON ou initialise les valeurs par défaut."""
        legacy_path = BASE_DIR / "strategy_config.json"
        if not os.path.exists(STRATEGY_CONFIG_PATH) and legacy_path.exists() and str(STRATEGY_CONFIG_PATH) != str(legacy_path):
            try:
                import shutil
                shutil.copy2(legacy_path, STRATEGY_CONFIG_PATH)
            except Exception:
                pass

        if os.path.exists(STRATEGY_CONFIG_PATH):
            try:
                with open(STRATEGY_CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # S'assurer que les clés minimales sont présentes
                    if "target_allocations" in data:
                        return data
            except Exception:
                pass
        cls.save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG

    @classmethod
    def save_config(cls, config: Dict[str, Any]) -> None:
        """Sauvegarde la configuration stratégique."""
        try:
            with open(STRATEGY_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[StrategyService] Erreur lors de la sauvegarde: {e}")

    @classmethod
    def get_allocation_analysis(cls, session: Session) -> Dict[str, Any]:
        """
        Compare l'allocation réelle actuelle avec l'allocation cible configurée.
        Calcule les écarts (Delta % et Delta €) et le statut de chaque classe d'actif.
        """
        config = cls.load_config()
        target_allocations = config.get("target_allocations", DEFAULT_PRESETS["balanced"]["allocations"])
        active_preset = config.get("active_preset", "balanced")

        summary = portfolio_service.get_portfolio_summary(session, force_refresh=False)
        total_net_worth = summary.get("total_net_worth", 0.0)
        raw_asset_classes = summary.get("allocation_asset_class", [])
        real_asset_classes = [
            {
                "name": item["name"],
                "value": item["value"],
                "percent": round((item["value"] / total_net_worth * 100.0), 2) if total_net_worth > 0 else 0.0,
            }
            for item in raw_asset_classes
        ]

        # Mapper les classes réelles par nom
        real_map: Dict[str, Dict[str, Any]] = {
            item["name"]: item for item in real_asset_classes
        }

        # Obtenir l'union de toutes les classes cibles et réelles
        all_classes = list(target_allocations.keys())
        for c in real_map.keys():
            if c not in all_classes:
                all_classes.append(c)

        analysis = []
        total_target_pct = sum(target_allocations.values())

        # Enveloppes suggérées pour chaque classe
        envelope_suggestions = {
            "Actions & ETF": "BoursoBank PEA (CW8 / ETF Monde) ou Revolut CTO (Actions US)",
            "Livrets & Épargne": "BNP Paribas (Livret A / LDDS) ou Coffres Revolut",
            "Épargne Entreprise (PEE)": "BNP Épargne Entreprise (FCPE Schneider)",
            "Retraite (PERO)": "Cardif Retraite / BNP EE",
            "Crypto": "Revolut Crypto (BTC-EUR / ETH)",
            "Fonds & OPCVM": "BoursoBank / BNP",
            "Immobilier & Autre": "Compte Principal",
        }

        for asset_name in all_classes:
            real_item = real_map.get(asset_name, {"value": 0.0, "percent": 0.0})
            current_val = float(real_item.get("value", 0.0))
            current_pct = float(real_item.get("percent", 0.0))
            target_pct = float(target_allocations.get(asset_name, 0.0))

            target_val = round((total_net_worth * (target_pct / 100.0)), 2) if total_net_worth > 0 else 0.0
            delta_pct = round(current_pct - target_pct, 2)
            delta_val = round(current_val - target_val, 2)

            if delta_pct < -1.5:
                status = "UNDERWEIGHT"   # À renforcer
            elif delta_pct > 1.5:
                status = "OVERWEIGHT"    # Surpondéré
            else:
                status = "BALANCED"      # Alignée avec la cible

            analysis.append({
                "asset_class": asset_name,
                "current_value": round(current_val, 2),
                "current_percent": round(current_pct, 2),
                "target_percent": round(target_pct, 2),
                "target_value": round(target_val, 2),
                "delta_percent": delta_pct,
                "delta_value": delta_val,
                "status": status,
                "suggested_envelope": envelope_suggestions.get(asset_name, "Compte d'investissement"),
            })

        # Trier : d'abord les plus sous-pondérées (opportunités d'achat), puis équilibrées, puis surpondérées
        analysis.sort(key=lambda x: x["delta_percent"])

        return {
            "total_net_worth": round(total_net_worth, 2),
            "active_preset": active_preset,
            "presets": DEFAULT_PRESETS,
            "target_allocations": target_allocations,
            "total_target_pct": round(total_target_pct, 2),
            "is_valid_100": abs(total_target_pct - 100.0) < 0.1,
            "analysis": analysis,
            "fire_settings": config.get("fire_settings", DEFAULT_CONFIG["fire_settings"]),
        }

    @classmethod
    def set_target_allocations(
        cls,
        allocations: Dict[str, float],
        preset_id: Optional[str] = "custom",
    ) -> Dict[str, Any]:
        """Met à jour les allocations cibles et enregistre la configuration."""
        config = cls.load_config()
        # Normaliser les valeurs en flottants
        clean_allocations = {k: round(float(v), 2) for k, v in allocations.items() if float(v) >= 0}
        config["target_allocations"] = clean_allocations
        config["active_preset"] = preset_id or "custom"
        cls.save_config(config)
        return config

    @classmethod
    def simulate_dca_rebalance(
        cls,
        session: Session,
        contribution_amount: float,
        custom_targets: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Algorithme de Rééquilibrage Dynamique par Apport de Liquidités (No-Sale Rebalancing).
        Calcule la ventilation optimale de `contribution_amount` pour combler prioritairement
        les sous-pondérations et minimiser l'écart quadratique par rapport aux cibles sans vente.
        """
        if contribution_amount <= 0:
            contribution_amount = 0.0

        config = cls.load_config()
        target_allocations = custom_targets or config.get("target_allocations", DEFAULT_PRESETS["balanced"]["allocations"])

        summary = portfolio_service.get_portfolio_summary(session, force_refresh=False)
        total_net_worth = summary.get("total_net_worth", 0.0)
        raw_asset_classes = summary.get("allocation_asset_class", [])

        real_map = {item["name"]: float(item.get("value", 0.0)) for item in raw_asset_classes}
        all_classes = list(set(list(target_allocations.keys()) + list(real_map.keys())))

        new_total_net_worth = total_net_worth + contribution_amount

        # 1. Calcul du déficit absolu pour chaque classe
        deficits: Dict[str, float] = {}
        for c in all_classes:
            current_v = real_map.get(c, 0.0)
            target_pct = target_allocations.get(c, 0.0)
            target_v = new_total_net_worth * (target_pct / 100.0)
            shortfall = max(0.0, target_v - current_v)
            deficits[c] = shortfall

        total_deficit = sum(deficits.values())
        allocations: Dict[str, float] = {c: 0.0 for c in all_classes}

        if contribution_amount > 0:
            if total_deficit > 0:
                if contribution_amount <= total_deficit:
                    # Distribuer proportionnellement aux déficits
                    for c, d in deficits.items():
                        if d > 0:
                            allocations[c] = round(contribution_amount * (d / total_deficit), 2)
                else:
                    # Combler tous les déficits
                    for c, d in deficits.items():
                        allocations[c] = round(d, 2)
                    remaining = contribution_amount - sum(allocations.values())
                    # Répartir le reliquat selon les pondérations cibles
                    total_target = sum(target_allocations.values()) or 100.0
                    for c in all_classes:
                        weight = target_allocations.get(c, 0.0) / total_target
                        allocations[c] = round(allocations[c] + (remaining * weight), 2)
            else:
                # Portefeuille déjà parfaitement aligné ou sans déficit : répartir selon les cibles
                total_target = sum(target_allocations.values()) or 100.0
                for c in all_classes:
                    weight = target_allocations.get(c, 0.0) / total_target
                    allocations[c] = round(contribution_amount * weight, 2)

            # Ajuster les éventuels arrondis de centimes sur l'actif recevant la plus forte allocation
            allocated_sum = sum(allocations.values())
            rounding_diff = round(contribution_amount - allocated_sum, 2)
            if abs(rounding_diff) > 0.001 and len(allocations) > 0:
                best_class = max(allocations.keys(), key=lambda k: allocations[k])
                allocations[best_class] = round(allocations[best_class] + rounding_diff, 2)

        # Enveloppes suggérées
        envelope_suggestions = {
            "Actions & ETF": "BoursoBank PEA (CW8 / ETF Monde)",
            "Livrets & Épargne": "BNP Paribas (Livret A / LDDS)",
            "Épargne Entreprise (PEE)": "BNP Épargne Entreprise (FCPE Schneider)",
            "Retraite (PERO)": "Cardif Retraite / BNP EE",
            "Crypto": "Revolut Crypto (BTC-EUR)",
            "Fonds & OPCVM": "BoursoBank / BNP",
            "Immobilier & Autre": "Compte Principal",
        }

        # 2. Construire la liste des recommandations et l'état post-versement
        plan = []
        for c in all_classes:
            curr_v = real_map.get(c, 0.0)
            curr_pct = round((curr_v / total_net_worth * 100.0), 2) if total_net_worth > 0 else 0.0
            allocated_v = allocations.get(c, 0.0)
            post_v = curr_v + allocated_v
            post_pct = round((post_v / new_total_net_worth * 100.0), 2) if new_total_net_worth > 0 else 0.0
            target_pct = target_allocations.get(c, 0.0)
            share_of_contribution = round((allocated_v / contribution_amount * 100.0), 1) if contribution_amount > 0 else 0.0

            plan.append({
                "asset_class": c,
                "allocated_amount": allocated_v,
                "share_of_contribution": share_of_contribution,
                "current_value": round(curr_v, 2),
                "current_percent": curr_pct,
                "post_value": round(post_v, 2),
                "post_percent": post_pct,
                "target_percent": target_pct,
                "delta_before": round(curr_pct - target_pct, 2),
                "delta_after": round(post_pct - target_pct, 2),
                "suggested_action": f"Verser {allocated_v:.2f} € sur {envelope_suggestions.get(c, c)}" if allocated_v > 0 else "Ne rien ajouter ce mois-ci (déjà pondéré)",
            })

        # Trier en mettant les classes qui reçoivent des fonds en premier
        plan.sort(key=lambda x: x["allocated_amount"], reverse=True)

        return {
            "contribution_amount": round(contribution_amount, 2),
            "current_total_net_worth": round(total_net_worth, 2),
            "new_total_net_worth": round(new_total_net_worth, 2),
            "plan": plan,
        }

    @classmethod
    def calculate_projections(
        cls,
        initial_capital: float,
        monthly_contribution: float,
        annual_return_pct: float = 7.0,
        years: int = 20,
        inflation_rate_pct: float = 2.0,
        swr_pct: float = 4.0,
        desired_monthly_expense: float = 2500.0,
    ) -> Dict[str, Any]:
        """
        Génère une simulation mathématique complète des intérêts composés,
        avec décomposition annuelle (Capital Initial / Versements / Intérêts),
        pouvoir d'achat corrigé de l'inflation et métriques d'indépendance financière (FIRE).
        """
        years = max(1, min(40, int(years)))
        monthly_r = (annual_return_pct / 100.0) / 12.0
        monthly_inflation = (inflation_rate_pct / 100.0) / 12.0

        yearly_points = []
        crossover_year = None
        current_nominal = initial_capital
        total_deposited = initial_capital

        for y in range(1, years + 1):
            months = y * 12
            total_deposited = initial_capital + (monthly_contribution * months)

            if monthly_r > 0:
                # Formule de la valeur future (Future Value) avec capitalisation mensuelle
                fv = (
                    initial_capital * math.pow(1.0 + monthly_r, months)
                    + monthly_contribution * ((math.pow(1.0 + monthly_r, months) - 1.0) / monthly_r)
                )
            else:
                fv = total_deposited

            interest_earned = max(0.0, fv - total_deposited)
            # Correction par l'inflation (pouvoir d'achat en euros constants)
            real_val = fv / math.pow(1.0 + (inflation_rate_pct / 100.0), y)

            # Intérêts générés uniquement sur l'année écoulée
            if y == 1:
                annual_interest_y = interest_earned
            else:
                prev_points = yearly_points[-1]
                annual_interest_y = interest_earned - prev_points["total_interest"]

            annual_deposits_y = monthly_contribution * 12.0
            if crossover_year is None and annual_interest_y >= annual_deposits_y and annual_deposits_y > 0:
                crossover_year = y

            # Rente mensuelle brute à 4% SWR
            monthly_passive_income = (fv * (swr_pct / 100.0)) / 12.0
            real_monthly_passive_income = (real_val * (swr_pct / 100.0)) / 12.0

            yearly_points.append({
                "year": y,
                "label": f"Année {y}",
                "initial_capital": round(initial_capital, 2),
                "total_deposited": round(total_deposited, 2),
                "cumulative_deposits_only": round(monthly_contribution * months, 2),
                "total_interest": round(interest_earned, 2),
                "annual_interest": round(annual_interest_y, 2),
                "nominal_portfolio": round(fv, 2),
                "real_portfolio": round(real_val, 2),
                "monthly_passive_income": round(monthly_passive_income, 2),
                "real_monthly_passive_income": round(real_monthly_passive_income, 2),
            })

        final_nominal = yearly_points[-1]["nominal_portfolio"] if yearly_points else initial_capital
        final_real = yearly_points[-1]["real_portfolio"] if yearly_points else initial_capital
        final_interest = yearly_points[-1]["total_interest"] if yearly_points else 0.0
        final_deposits = yearly_points[-1]["total_deposited"] if yearly_points else initial_capital

        interest_ratio_pct = round((final_interest / final_nominal * 100.0), 1) if final_nominal > 0 else 0.0

        # Calculateur FIRE
        target_fire_capital = (desired_monthly_expense * 12.0) / (swr_pct / 100.0) if swr_pct > 0 else 0.0
        lean_fire_capital = target_fire_capital * 0.75
        fat_fire_capital = target_fire_capital * 1.30

        fire_progress_pct = min(100.0, round((initial_capital / target_fire_capital * 100.0), 1)) if target_fire_capital > 0 else 0.0

        # Année prévisionnelle d'atteinte du FIRE
        years_to_fire = None
        for pt in yearly_points:
            if pt["nominal_portfolio"] >= target_fire_capital:
                years_to_fire = pt["year"]
                break

        return {
            "parameters": {
                "initial_capital": round(initial_capital, 2),
                "monthly_contribution": round(monthly_contribution, 2),
                "annual_return_pct": round(annual_return_pct, 2),
                "years": years,
                "inflation_rate_pct": round(inflation_rate_pct, 2),
                "swr_pct": round(swr_pct, 2),
                "desired_monthly_expense": round(desired_monthly_expense, 2),
            },
            "summary": {
                "final_nominal_portfolio": round(final_nominal, 2),
                "final_real_portfolio": round(final_real, 2),
                "total_deposited": round(final_deposits, 2),
                "total_interest_earned": round(final_interest, 2),
                "interest_ratio_percent": interest_ratio_pct,
                "final_monthly_passive_income": round((final_nominal * (swr_pct / 100.0)) / 12.0, 2),
                "final_real_monthly_passive_income": round((final_real * (swr_pct / 100.0)) / 12.0, 2),
                "crossover_year": crossover_year,
            },
            "fire": {
                "desired_monthly_expense": round(desired_monthly_expense, 2),
                "target_fire_capital": round(target_fire_capital, 2),
                "lean_fire_capital": round(lean_fire_capital, 2),
                "fat_fire_capital": round(fat_fire_capital, 2),
                "fire_progress_percent": fire_progress_pct,
                "years_to_fire": years_to_fire,
            },
            "projections": yearly_points,
        }


strategy_service = StrategyService()
