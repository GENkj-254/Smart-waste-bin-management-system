#include <WiFi.h>
#include <HTTPClient.h>

// ✅ Replace with your WiFi credentials
const char* ssid = "Genius";
const char* password = "1234567890";

// ✅ Replace with your actual MongoDB binId (_id, not binId number!)
const String binId = "64f123abc456def789123456";
const String serverName = "https://smart-waste-bin-management-system.onrender.com/api/bin/" + binId + "/data";

// Sensor and buzzer pins
const int trigPin = 5;
const int echoPin = 18;
const int buzzerPin = 23;

long duration;
int distance;
int binHeight = 30; // in cm
int fillLevel = 0;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void reconnectWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("Reconnecting to WiFi");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nReconnected");
  }
}

void loop() {
  reconnectWiFi();

  // Trigger ultrasonic measurement
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH);
  distance = duration * 0.034 / 2;

  // Calculate fill level
  fillLevel = map(distance, 0, binHeight, 100, 0);
  fillLevel = constrain(fillLevel, 0, 100);

  Serial.print("Fill Level: ");
  Serial.print(fillLevel);
  Serial.println("%");

  // Send to backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    // Optional: Add auth if needed
    // http.addHeader("Authorization", "Bearer YOUR_TOKEN");

    String payload = "{\"fillLevel\":" + String(fillLevel) + "}";
    int code = http.POST(payload);

    if (code > 0) {
      String res = http.getString();
      Serial.println("Server response: " + res);
      if (fillLevel >= 90) {
        tone(buzzerPin, 1000, 1000); delay(1000); noTone(buzzerPin);
      }
    } else {
      Serial.print("HTTP Error: ");
      Serial.println(code);
    }

    http.end();
  } else {
    Serial.println("WiFi disconnected!");
  }

  delay(10000); // Run every 10 seconds
}
