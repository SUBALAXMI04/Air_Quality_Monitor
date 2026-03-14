# Smart Air Quality Monitoring System – Cloud Integration

## Overview

This module implements the cloud integration of the Smart Air Quality Monitoring System.
The ESP32 microcontroller collects environmental data and uploads it to Firebase Realtime Database every 1 minute.

The cloud stores the data and makes it available for dashboard visualization and alert monitoring.

---

## Responsibilities

This module includes the following tasks:

* Define dashboard layout
* Decide alert display method
* Prepare dashboard structure plan
* Connect ESP32 to Firebase
* Implement automatic data upload
* Implement WiFi reconnection handling

---

## System Data Flow

Sensors → ESP32 → WiFi → Firebase → Dashboard

1. Sensors collect environmental data
2. ESP32 processes the readings
3. Data is transmitted to Firebase
4. Firebase stores the data
5. Dashboard displays the information

---

## Data Upload Frequency

Sensor data is uploaded to Firebase **every 1 minute**.

Each upload includes:

* Temperature
* Humidity
* CO level
* PM2.5 value
* Air Quality Index (AQI)
* Timestamp

---

## Firebase Database Structure

```
air_quality_monitor
    device_1
        temperature
        humidity
        co_level
        pm25
        aqi
        timestamp
```

---
