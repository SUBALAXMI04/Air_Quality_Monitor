# Air Quality Monitor - Hardware Setup Guide

## 📦 Components Required

### Main Components
| Component | Purpose | Interface |
|-----------|---------|-----------|
| **ESP32 NodeMCU** | Main processor, WiFi | - |
| **BME688** | Temp, Humidity, Pressure, Gas Resistance (VOCs) | I2C |
| **SCD40** | CO2 | I2C |
| **PMS5003** | PM1.0, PM2.5, PM10 | UART1 (Pins 16/17) |
| **ZE07-CO** | Carbon Monoxide | UART2 (Pins 25/26) |
| **Jumper Wires** | Connections | - |

### Required Arduino Libraries

Install these via **Arduino IDE → Sketch → Include Library → Manage Libraries**:

1. **Adafruit BME680 Library** by Adafruit *(Click "Install All" to get dependencies)*
2. **Sensirion I2C SCD4x** by Sensirion
3. **Firebase ESP Client** by Mobizt

---

## 🔌 Wiring Diagram

### Pinout Reference
- **I2C Bus:** SDA = GPIO21, SCL = GPIO22 (Shared by BME688 and SCD40)
- **UART 1:** RX = GPIO16, TX = GPIO17 (Used by PMS5003)
- **UART 2:** RX = GPIO25, TX = GPIO26 (Used by ZE07-CO)

### Complete Wiring Table

| ESP32 Pin | BME688 | SCD40 | PMS5003 | ZE07-CO |
|-----------|--------|-------|---------|---------|
| **3.3V** | VCC/VIN | VCC | - | - |
| **5V (VIN)** | - | - | VIN (5V) | VIN (5V) |
| **GND** | GND | GND | GND | GND |
| **GPIO21** | SDA | SDA | - | - |
| **GPIO22** | SCL | SCL | - | - |
| **GPIO16** | - | - | TXD | - |
| **GPIO17** | - | - | RXD | - |
| **GPIO25** | - | - | - | TXD |
| **GPIO26** | - | - | - | RXD |

### Wiring Steps

1. **Connect Power Rails (⚠️ Crucial Step):**
   - **BME688 & SCD40:** Connect their power pins to the **3.3V** pin on the ESP32. Do *not* plug these delicate boards into 5V.
   - **PMS5003 & ZE07-CO:** Connect their power pins to the **5V (VIN)** pin on the ESP32. The PMS5003 needs 5V to power its internal laser-fan.
   - Connect all sensor **GND** pins to the ESP32 **GND**.

2. **Connect I2C Sensors (BME688 & SCD40):**
   - Connect **SDA** from both sensors to **GPIO21**.
   - Connect **SCL** from both sensors to **GPIO22**.
   - *(Note: I2C is a shared bus. It is normal and required for them to share these exact two pins).*

3. **Connect UART Sensors:**
   - **PMS5003 (PM Sensor):** Connect its TXD wire to ESP32 **Pin 16**. Connect its RXD wire to ESP32 **Pin 17**.
   - **ZE07-CO:** Connect its TXD to ESP32 **Pin 25**. Connect its RXD to ESP32 **Pin 26**.

---

## 💻 Software Setup

### 1. Arduino IDE Configuration

```cpp
// Tools → Board → ESP32 Arduino → "ESP32 Dev Module"
// Tools → Port → Select your ESP32 COM port
// Tools → Upload Speed → 115200 or 921600
```

### 2. Upload the Code

1. Open a blank Arduino sketch.
2. Copy the contents of `esp32/esp32_hardware_real.ino` from VS Code.
3. Paste into the Arduino window.
4. Put your Wi-Fi Name and Password at the very top of the code!
5. Hit the **Upload** arrow.

### 3. Monitor Output

Open Serial Monitor (Tools → Serial Monitor or Ctrl+Shift+M):
- **Baud rate MUST be set to:** **115200**
- You will see the sensors initialize and start publishing 9 lines of telemetry locally before uploading to Firebase.

---

## 🔧 Troubleshooting

### Problem: "I2C Device Initialization Failed"
**Check:**
- Wiring: SDA→GPIO21, SCL→GPIO22
- Voltage: Ensure the BME688 and SCD40 are receiving exactly 3.3V, not 5V.
- Libraries: Ensure Adafruit BME680 library is installed.

### Problem: "PMS5003 reading 0"
**Check:**
- The PMS5003 uses a laser and fan. You should feel a tiny breeze or faint mechanical hum from the blue box.
- Make sure it is connected to **5V (VIN)**, not 3.3V. 3.3V cannot power the internal motor.
- Try explicitly swapping pins 16 and 17 if data refuses to parse.

### Problem: "Gas Resistance mapping"
**Understanding Gas Resistance:**
Unlike VOC index which graphs "Higher is worse", the BME688 outputs raw Gas Resistance. 
- Higher Resistance (~50kΩ+) = Clean Air 
- Lower Resistance (<15kΩ) = Heavy VOCs/Polluted Air.

### Problem: "Missing FQBN / Compilation Error"
**Check:**
- You must click the "Boards Manager" icon on the left of Arduino IDE, search for **esp32**, and hit **INSTALL**. The IDE needs this download to understand how to compile the ESP32 files.
