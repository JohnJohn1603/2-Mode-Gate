import cv2
import mediapipe as mp
import serial
import time
import hand_def

# STATE_DEACTIVATE = 0
# STATE_ACTIVATE   = 1

# state = STATE_DEACTIVATE
mode_state = "DEACT"   # ACT / DEACT
move_state = None      # UP / DOWN

# ===== SERIAL =====
ser = serial.Serial('COM3', 115200)
time.sleep(2)

# ===== MEDIAPIPE =====
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# ===== CAMERA =====
cap = cv2.VideoCapture(0)

last_state = None  # tránh spam serial

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hands.process(rgb)

        if result.multi_hand_landmarks:
            # Vẽ tay để xac dinh
            for hand_landmarks in result.multi_hand_landmarks:
                mp_draw.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS
                )

            lm = result.multi_hand_landmarks[0].landmark

            # ===== ACTIVATE / DEACTIVATE =====
            if hand_def.handOpen(lm):
                if mode_state != "ACT":
                    print("ACT")
                    ser.write(b"ACT\n")
                    mode_state = "ACT"
                    move_state = None

            elif hand_def.handClose(lm):
                if mode_state != "DEACT":
                    print("DEACT")
                    ser.write(b"DEACT\n")
                    mode_state = "DEACT"
                    move_state = None

            # ===== UP / DOWN (chỉ khi ACT) =====
            if mode_state == "ACT":
                if hand_def.upHand(lm):
                    if move_state != "UP":
                        print("UP")
                        ser.write(b"UP\n")
                        move_state = "UP"

                elif hand_def.downHand(lm):
                    if move_state != "DOWN":
                        print("DOWN")
                        ser.write(b"DOWN\n")
                        move_state = "DOWN"

        if ser.in_waiting:
            line = ser.readline().decode().strip()
            print("ESP32:", line)

        cv2.imshow("Hand Control", frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    ser.close()



