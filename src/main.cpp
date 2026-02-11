#include <Arduino.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

Servo servo;
Servo servoHand; 

// Servo 1
const int SERVO_PIN = 16;
const int HOME_ANGLE = 0;
const int TARGET_ANGLE = 90;
const unsigned long INTERVAL = 1500; // ms

// Servo 2
const int SERVO_PIN_2 = 27;
const int HOME_ANGLE_2 = 90;
const int TARGET_ANGLE_2 = 0;
const unsigned long INTERVAL_2 = 1500; // ms

// RFIO-RC522
#define SDA   5   
#define SCK   18
#define MOSI  19
#define MISO  21
#define RST   33

//HC-SR04
#define TRIG_PIN 22
#define ECHO_PIN 23

MFRC522 rfid(SDA, RST);

unsigned long lastTime = 0;
bool atHome = true;

bool authorized = false;
unsigned long lastPrint = 0;

byte validUID[] = {0x24, 0xEB, 0xE6, 0x0};

enum GateState {
  IDLE,
  OPEN,
  WAIT_EXIT
};

enum HandState {
  DEACTIVATE,
  ACTIVATE
};



HandState handState = DEACTIVATE;
GateState gateState = IDLE;

void setup() {
  Serial.begin(115200);

  // 1st servo
  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  servo.write(HOME_ANGLE);

  // 2nd servo
  servoHand.setPeriodHertz(50);
  servoHand.attach(SERVO_PIN_2, 500, 2400);
  servoHand.write(HOME_ANGLE_2);

  // HC-SR04
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);  

  // RFIO-RC522
  SPI.begin(SCK, MISO, MOSI, SDA); // SPI Initialization
  rfid.PCD_Init(); // RC522 Initialization
  Serial.println("RC522 ready");

  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("RC522 version: 0x");
  Serial.println(v, HEX);
}

void openGate(){
  servo.write(TARGET_ANGLE);
}
void closeGate(){
  servo.write(HOME_ANGLE);
}

void handleCommand(String cmd) {
  if (cmd == "ACT") {
    handState = ACTIVATE;
  }
  else if (cmd == "DEACT") {
    handState = DEACTIVATE;
    servoHand.write(HOME_ANGLE_2);
  }
  else if (handState == ACTIVATE) {
    if (cmd == "DOWN") {
      servoHand.write(TARGET_ANGLE_2);
    }
    else if (cmd == "UP") {
      servoHand.write(HOME_ANGLE_2);
    }
  }
}

long getDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms
  if (duration == 0) return -1; // không đo được

  return duration / 58; // cm
}

void loop() {
  unsigned long now = millis();

  // 1. Đọc RFID
  if (gateState == IDLE) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {

      authorized = true;

      if (rfid.uid.size != sizeof(validUID)) {
        authorized = false;
      } 
      else {
        for (byte i = 0; i < rfid.uid.size; i++) {
          if (rfid.uid.uidByte[i] != validUID[i]) {
            authorized = false;
            break;
          }
        }
      }

      if (authorized) {
        Serial.println("OpenGate");
        openGate();
        gateState = OPEN;
      } else {
        Serial.println("Access Denied!");
      }

      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    }
  }

  // 2. Khi cổng đang mở → theo dõi HC-SR04
  if (gateState == OPEN) {
    if (now - lastTime >= 200) {   // đo mỗi 200ms
      lastTime = now;

      long distance = getDistanceCM();
      Serial.println(distance);
      if (distance > 4) {
        delay(1000);
        Serial.println("CloseGate");
        closeGate();
        gateState = IDLE;
      }
    }
  }

    if (Serial.available()) {

      String cmd = Serial.readStringUntil('\n');
      cmd.trim();

      Serial.print("Received: ");
      Serial.println(cmd);

      handleCommand(cmd);
    }
}
