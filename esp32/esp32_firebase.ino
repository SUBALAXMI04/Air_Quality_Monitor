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
    connectWiFi();
  }

  if (Firebase.ready() && millis() - sendDataPrevMillis > 60000)
  {
    sendDataPrevMillis = millis();

    float temperature = random(25, 35);
    float humidity = random(50, 80);
    float gas = random(100, 300);

    Firebase.RTDB.setFloat(&fbdo, "air_quality/device1/temperature", temperature);
    Firebase.RTDB.setFloat(&fbdo, "air_quality/device1/humidity", humidity);
    Firebase.RTDB.setFloat(&fbdo, "air_quality/device1/gas_level", gas);

    Serial.println("Data uploaded to Firebase");
  }
}