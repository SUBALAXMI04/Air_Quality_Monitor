import pandas as pd
import numpy as np
from pathlib import Path

Path("data").mkdir(exist_ok=True)
periods = 240
index = pd.date_range(start="2026-01-01 00:00", periods=periods, freq="h")
np.random.seed(42)
aqi = np.clip(50 + np.cumsum(np.random.randn(periods)), 10, 200)
pm25 = np.clip(10 + np.random.randn(periods) * 3, 0, 120)
pm10 = np.clip(20 + np.random.randn(periods) * 5, 0, 180)
no2 = np.clip(15 + np.random.randn(periods) * 4, 0, 100)
so2 = np.clip(5 + np.random.randn(periods) * 2, 0, 30)
co = np.clip(0.4 + np.random.randn(periods) * 0.1, 0.1, 2.0)
o3 = np.clip(25 + np.random.randn(periods) * 6, 0, 120)
temp = np.clip(15 + np.random.randn(periods) * 5, -5, 40)
humidity = np.clip(55 + np.random.randn(periods) * 15, 10, 100)
wind = np.clip(2 + np.random.randn(periods) * 0.8, 0, 10)
pressure = np.clip(1015 + np.random.randn(periods) * 5, 980, 1040)

df = pd.DataFrame({
    "datetime": index,
    "AQI": np.round(aqi, 0),
    "PM2.5": np.round(pm25, 1),
    "PM10": np.round(pm10, 1),
    "NO2": np.round(no2, 1),
    "SO2": np.round(so2, 1),
    "CO": np.round(co, 2),
    "O3": np.round(o3, 1),
    "temperature": np.round(temp, 1),
    "humidity": np.round(humidity, 1),
    "wind_speed": np.round(wind, 2),
    "pressure": np.round(pressure, 1),
})

np.random.seed(1)
for col in ["AQI", "PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "temperature", "humidity", "wind_speed", "pressure"]:
    missing = np.random.choice(periods, size=8, replace=False)
    df.loc[missing, col] = np.nan

output_path = Path("data/aqi_data.csv")
df.to_csv(output_path, index=False)
print(f"sample dataset created: {output_path}")
