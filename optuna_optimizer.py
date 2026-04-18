import optuna
import requests
import json
import time

# Target endpoint to test parameters
# Replace with your local or deployed API URL if needed.
# For local preview: http://localhost:3000/api/backtest
API_URL = "http://localhost:3000/api/backtest"

def objective(trial):
    # Suggest hyper-parameters
    p_maFast = trial.suggest_int('maFast', 2, 10)
    p_maSlow = trial.suggest_int('maSlow', 15, 60)
    p_minPeriod = trial.suggest_int('minPeriod', 15, 60)
    p_maxShort = trial.suggest_int('maxShort', 2, 10)
    p_maxLong = trial.suggest_int('maxLong', 10, 30)
    
    p_stopLossPct = trial.suggest_float('stopLossPct', 0.05, 0.15, step=0.005)
    p_takeProfitPct = trial.suggest_float('takeProfitPct', 0.02, 0.15, step=0.01)
    p_reboundPct = trial.suggest_float('reboundPct', 0.005, 0.05, step=0.005)

    payload = {
        "initialCapital": 1000000,
        "takeProfitStrategy": "3day_high",
        "params": {
            "maFast": p_maFast,
            "maSlow": p_maSlow,
            "minPeriod": p_minPeriod,
            "maxShort": p_maxShort,
            "maxLong": p_maxLong,
            "stopLossPct": p_stopLossPct,
            "takeProfitPct": p_takeProfitPct,
            "reboundPct": p_reboundPct
        }
    }

    try:
        response = requests.post(API_URL, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()
        data = response.json()
        
        if data.get('success'):
            metrics = data.get('metrics', {})
            # We optimize for Annualized Return (or you can use a formula like Return / MaxDrawdown)
            annualized_return = metrics.get('annualizedReturn', 0)
            
            # Penalize strategies with less than 5 trades to avoid overfitting
            if metrics.get('totalTrades', 0) < 5:
                return -9999.0
            
            return annualized_return
        else:
            return -9999.0  # Failed run
    except Exception as e:
        print(f"Error during request: {e}")
        return -9999.0

if __name__ == "__main__":
    print("Starting Optuna Hyper-Parameter Optimization...")
    print(f"Targeting API Endpoint: {API_URL}\n")
    
    # We want to MAXIMIZE the annualized return
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=100)

    print("\noptimization finished.")
    print("Best Trial:")
    trial = study.best_trial
    
    print(f"  Value (Annualized Return): {trial.value}%")
    print("  Params: ")
    for key, value in trial.params.items():
        print(f"    {key}: {value}")
