#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <SensirionI2cScd4x.h>
#include <Wire.h>
#include <HardwareSerial.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <time.h>

// USER CONFIGURATION
#define WIFI_SSID "IITT"
#define WIFI_PASSWORD "user@123"

#define API_KEY "AIzaSyAqLwgpkEBubO9ExkpSN6mivSmO6tympTk"
#define DATABASE_URL "https://aqi-moitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// Time configuration for India (IST = UTC + 5:30)
#define GMT_OFFSET_SEC 19800
#define DAYLIGHT_OFFSET_SEC 0
const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const char* NTP_SERVER_3 = "time.google.com";

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// I2C Sensors (BME688 & SCD40)
Adafruit_BME680 bme;
SensirionI2cScd4x scd40;

// UART Sensors (Hardware Serial)
HardwareSerial SerialPM(1); // UART1
HardwareSerial SerialCO(2); // UART2

#define PM_RX 16
#define PM_TX 17
#define CO_RX 25
#define CO_TX 26

// State variables
unsigned long sendDataPrevMillis = 0;
bool firebaseInitialized = false;
bool timeSynced = false;
const unsigned long UPLOAD_INTERVAL = 60000;

// Custom Sensor data structure
struct SensorData {
  float temperature;    // From BME688
  float humidity;       // From BME688
  float pressure;       // From BME688
  float gas_resistance; // From BME688
  float co2;            // From SCD40
  float pm1_0;          // From PMS5003
  float pm25;           // From PMS5003
  float pm10;           // From PMS5003
  float co;             // From ZE07-CO

  bool bme_ready;
  bool scd40_ready;
  bool pm_ready;
  bool co_ready;
};

SensorData currentData = {0};

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed! Restarting...");
    delay(3000);
    ESP.restart();
  }
}

void syncTime() {
  Serial.println("Synchronizing time with NTP...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);

  struct tm timeinfo;
  for (int i = 0; i < 30; i++) {
    if (getLocalTime(&timeinfo, 1000)) {
      timeSynced = true;
      Serial.println("Time synchronized successfully");
      Serial.print("Current date/time: ");
      Serial.println(&timeinfo, "%Y-%m-%d %H:%M:%S");
      return;
    }
    delay(500);
  }

  timeSynced = false;
  Serial.println("NTP sync failed. History will still work using millis() keys.");
}

String getTimestampValue() {
  time_t now = time(nullptr);

  // If time is synced, use real Unix time.
  // If not, fall back to millis() so keys are still unique.
  if (now > 1700000000) {
    return String((uint32_t)now);
  }
  return String(millis());
}

void initSensors() {
  Wire.begin();
  Serial.println("Initializing sensors...");

  // Initialize SCD40
  scd40.begin(Wire, 0x62);
  if (scd40.stopPeriodicMeasurement()) {
    Serial.println("SCD40 stopPeriodicMeasurement returned an error");
  }
  if (scd40.startPeriodicMeasurement()) {
    Serial.println("SCD40 initialization failed!");
    currentData.scd40_ready = false;
  } else {
    Serial.println("SCD40 initialized");
    currentData.scd40_ready = true;
  }

  // Initialize BME688
  if (!bme.begin()) {
    Serial.println("BME688 initialization failed! Check I2C wiring.");
    currentData.bme_ready = false;
  } else {
    Serial.println("BME688 initialized");
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150);
    currentData.bme_ready = true;
  }

  // Initialize UARTs
  SerialPM.begin(9600, SERIAL_8N1, PM_RX, PM_TX);
  Serial.println("PMS5003 initialized on Pins 16/17");
  currentData.pm_ready = true;

  SerialCO.begin(9600, SERIAL_8N1, CO_RX, CO_TX);
  Serial.println("ZE07-CO initialized on Pins 25/26");
  currentData.co_ready = true;

  Serial.println("All sensor buses configured!");
  delay(1000);
}

void readSensors() {
  // Read SCD40
  if (currentData.scd40_ready) {
    uint16_t co2;
    float scd_temp;
    float scd_hum;
    if (scd40.readMeasurement(co2, scd_temp, scd_hum) == 0 && co2 != 0) {
      currentData.co2 = co2;
      // Using BME688 for temperature/humidity
    }
  }

  // Read BME688
  if (currentData.bme_ready && bme.performReading()) {
    currentData.temperature = bme.temperature;
    currentData.humidity = bme.humidity;
    currentData.pressure = bme.pressure / 100.0;       // Pa -> hPa
    currentData.gas_resistance = bme.gas_resistance / 1000.0; // Ohms -> KOhms
  }

  // Read PMS5003 (32 byte protocol)
  if (SerialPM.available() >= 32) {
    if (SerialPM.peek() != 0x42) {
      SerialPM.read();
    } else {
      uint8_t buf[32];
      SerialPM.readBytes(buf, 32);
      if (buf[1] == 0x4D) {
        currentData.pm1_0 = (buf[10] << 8) | buf[11];
        currentData.pm25  = (buf[12] << 8) | buf[13];
        currentData.pm10  = (buf[14] << 8) | buf[15];
      }
    }
  }
  while (SerialPM.available()) SerialPM.read();

  // Read ZE07-CO (9 byte protocol)
  if (SerialCO.available() >= 9) {
    uint8_t buf[9];
    SerialCO.readBytes(buf, 9);
    if (buf[0] == 0xFF && (buf[1] == 0x04 || buf[1] == 0x86)) {
      float coVal = (buf[2] << 8) | buf[3];
      currentData.co = coVal;
    }
  }
  while (SerialCO.available()) SerialCO.read();
}

void printSensorData() {
  Serial.println("\nCurrent Sensor Readings:");
  Serial.printf("Temperature: %.1f C\n", currentData.temperature);
  Serial.printf("Humidity: %.0f %%\n", currentData.humidity);
  Serial.printf("Pressure: %.2f hPa\n", currentData.pressure);
  Serial.printf("Gas Resistance: %.2f KOhms\n", currentData.gas_resistance);
  Serial.printf("CO2: %.0f ppm\n", currentData.co2);
  Serial.printf("PM1.0: %.1f ug/m3\n", currentData.pm1_0);
  Serial.printf("PM2.5: %.1f ug/m3\n", currentData.pm25);
  Serial.printf("PM10: %.1f ug/m3\n", currentData.pm10);
  Serial.printf("CO: %.1f ppm\n", currentData.co);
}

void setupFirebase() {
  Serial.println("Initializing Firebase...");
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Firebase.reconnectWiFi(true);
  Firebase.setDoubleDigits(5);

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase authentication successful");
    firebaseInitialized = true;
  } else {
    Serial.printf("Firebase auth failed: %s\n", config.signer.signupError.message.c_str());
    firebaseInitialized = false;
    return;
  }

  Firebase.begin(&config, &auth);
  Serial.println("Firebase initialized");
}

bool uploadSnapshotToPath(const String& path, const String& timestampValue) {
  bool success = true;

  success &= Firebase.RTDB.setFloat(&fbdo, path + "/temperature", currentData.temperature);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/humidity", currentData.humidity);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/pressure", currentData.pressure);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/gas_resistance", currentData.gas_resistance);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/co2", currentData.co2);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/co", currentData.co);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/pm1_0", currentData.pm1_0);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/pm25", currentData.pm25);
  success &= Firebase.RTDB.setFloat(&fbdo, path + "/pm10", currentData.pm10);
  success &= Firebase.RTDB.setString(&fbdo, path + "/timestamp", timestampValue);

  return success;
}

void uploadToFirebase() {
  if (!firebaseInitialized) return;

  String rootPath = "air_quality/device1";
  String timestampValue = getTimestampValue();

  String latestPath = rootPath + "/latest";
  String historyPath = rootPath + "/history/" + timestampValue;

  Serial.println("Uploading sensor data...");

  bool latestOk = uploadSnapshotToPath(latestPath, timestampValue);
  bool historyOk = uploadSnapshotToPath(historyPath, timestampValue);

  if (latestOk && historyOk) {
    Serial.println("Data uploaded successfully to latest and history!");
  } else {
    Serial.println("Some data failed to upload");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\nSystem Booting...");

  initSensors();
  connectWiFi();
  syncTime();
  setupFirebase();

  Serial.println("\nGiving sensors 5 seconds to grab initial readings...");
  for (int i = 0; i < 50; i++) {
    readSensors();
    delay(100);
  }

  uploadToFirebase();
  printSensorData();

  Serial.println("\nEntering main loop...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    syncTime();
  }

  if (!firebaseInitialized && WiFi.status() == WL_CONNECTED) {
    setupFirebase();
  }

  readSensors();

  if (Firebase.ready() && firebaseInitialized) {
    if (millis() - sendDataPrevMillis > UPLOAD_INTERVAL) {
      sendDataPrevMillis = millis();
      uploadToFirebase();
      printSensorData();
    }
  }

  delay(100);
}