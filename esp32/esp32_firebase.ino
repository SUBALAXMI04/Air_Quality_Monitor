#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "../config/firebase_config.h"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;

void connectWiFi()
{
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED)
  {
    Serial.print(".");
    delay(500);
  }

  Serial.println();
  Serial.println("WiFi Connected");
}

void setup()
{
  Serial.begin(115200);

  connectWiFi();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("Reconnecting WiFi...");
    connectWiFi();
  }

  if (Firebase.ready() && millis() - sendDataPrevMillis > 60000)
  {
    sendDataPrevMillis = millis();

    float temperature = 28.5;
    float humidity = 65;
    float co_level = 10;
    float pm25 = 40;
    float aqi = 75;

    Firebase.RTDB.setFloat(&fbdo, "air_quality_monitor/device_1/temperature", temperature);
    Firebase.RTDB.setFloat(&fbdo, "air_quality_monitor/device_1/humidity", humidity);
    Firebase.RTDB.setFloat(&fbdo, "air_quality_monitor/device_1/co_level", co_level);
    Firebase.RTDB.setFloat(&fbdo, "air_quality_monitor/device_1/pm25", pm25);
    Firebase.RTDB.setFloat(&fbdo, "air_quality_monitor/device_1/aqi", aqi);

    Serial.println("Data uploaded to Firebase");
  }
}