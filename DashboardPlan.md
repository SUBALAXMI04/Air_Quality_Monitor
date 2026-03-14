# Dashboard Structure Plan

## Dashboard Layout

The dashboard is divided into four sections.

---

## SMART AIR QUALITY MONITORING DASHBOARD

1. AQI Status Panel
2. Sensor Data Display
3. Line Graph Visualization
4. Alerts and Notifications

---

## AQI Display

The Air Quality Index is displayed with color indicators.

| AQI Range | Air Quality                    | Color    |
| --------- | ------------------------------ | -------- |
| 0–50      | Good                           | Green    |
| 51–100    | Moderate                       | Yellow   |
| 101–150   | Unhealthy for Sensitive Groups | Orange   |
| 151–200   | Unhealthy                      | Red      |
| 201–300   | Very Unhealthy                 | Purple   |
| 301+      | Hazardous                      | Dark Red |

---

## Sensor Data Display

The dashboard shows real-time values for:

* Temperature (°C)
* Humidity (%)
* CO Level (ppm)
* PM2.5 (µg/m³)

---

## Graph Visualization

Line graphs display variations over time.

Graphs included:

* PM2.5 vs Time
* CO Level vs Time
* Temperature vs Time
* Humidity vs Time

The graphs update whenever new data is uploaded.

---

## Alert Display Method

Alerts are triggered when pollution exceeds safe limits.

Example thresholds:

PM2.5 > 100 µg/m³
CO > 50 ppm
AQI > 150

Alert methods:

* Warning message on dashboard
* Color change in AQI indicator
* Notification message
