# Hệ thống Cổng Thông Minh RFID (Smart RFID Gate)

Dự án này là một hệ thống cổng kiểm soát ra vào thông minh sử dụng mạch ESP32 kết hợp với giao diện Web quản lý trực quan. Hệ thống có khả năng đăng ký thẻ trực tiếp thông qua giao diện Web mà không cần thao tác dán mã thủ công, lưu trữ dữ liệu lên MongoDB và tự động đóng/mở cổng qua cảm biến khoảng cách.

---

## 🛠️ Yêu cầu phần cứng & Công nghệ sử dụng
### Phần cứng
* **Mạch điều khiển:** ESP32
* **Đầu đọc thẻ RFID:** MFRC522
* **Cảm biến siêu âm:** HC-SR04 (phát hiện khi có xe qua để đóng cổng)
* **Động cơ Servo:** 2 x Servo (Servo cổng và Servo cơ cấu phụ)

### Phần mềm
* C/C++ (Arduino Framework) quản lý bằng PlatformIO
* Node.js, Express (phía Server)
* HTML, CSS, JavaScript (Giao diện hiển thị Dashboard)
* MongoDB (Cơ sở dữ liệu lưu thẻ và người dùng)
* Thư viện `serialport` kết nối Board mạch với máy tính/web.

---

## 📂 Kiến trúc dự án

```text
KNCN-BTL/
│
├── src/
│   └── main.cpp           # Mã nguồn C++ nạp cho mạch ESP32.
│
└── webapp/
    ├── server.js          # Back-end Node.js & Logic giao tiếp Serial
    ├── package.json       # Danh sách thư viện Node.js
    └── public/
        └── index.html     # Giao diện Web (Dashboard) thao tác với hệ thống
```

---

## 🚀 Luồng hoạt động của hệ thống

Hệ thống hoạt động ở **2 chế độ** dựa trên logic tương tác giữa ESP32 và Server Node.js qua Serial (Cáp USB):

### 1. Chế độ Kiểm soát mở/đóng cổng (Hoạt động bình thường)
1. Người dùng quẹt thẻ RFID vào máy đọc MFRC522.
2. ESP32 nhận mã và in ra cổng Serial dưới dạng `UID:XXXXXXXX`.
3. Trong lúc đó, ESP32 sẽ tạm dừng và chờ phản hồi ngược lại (tối đa 1 giây).
4. `server.js` lúc nào cũng trực lắng nghe cổng Serial. Khi thấy `UID:XXXXXXXX`, nó sẽ đối chiếu với cơ sở dữ liệu MongoDB.
   * Nếu thẻ **đã được lưu**, Server trả lại dòng lệnh `OPEN\n`.
   * Nếu thẻ **chưa được lưu**, Server trả lệnh `DENY\n`.
5. ESP32 nhận `OPEN` thì sẽ quay động cơ Servo mở cổng.
6. Khi cổng đã mở, cảm biến siêu âm HC-SR04 liên tục đo khoảng cách. Khi xe chạy qua (khoảng cách > 4cm và sau ít nhất 1s), ESP32 tự động quay Servo đóng cổng lại.

### 2. Chế độ Đăng ký thẻ mới trên Web
1. Tại giao diện web, Quản trị viên nhập họ tên và nhấn nút **"Bắt đầu đăng ký thẻ"**.
2. Phía Web gửi 1 API (chờ 30 giây) để yêu cầu Server báo cho Node.js kích hoạt *Chế độ Đăng ký*.
3. Giao diện từ nút ấn sẽ chuyển thành nhấp nháy **"Đang chờ quẹt thẻ..."**.
4. Quản trị viên quẹt thẻ mới bất kỳ vào đầu đọc RFID.
5. ESP32 gửi `UID` lên. Server thay vì đối chiếu mở cổng thì sẽ lấy `UID` này gán vào Tên quản trị viên vừa nhập, đưa vào MongoDB.
6. Server trả kết quả về cho Web thành công, Web tự động tải lại danh sách nhận tên mới rắt nhanh chóng. Mạch cũng sẽ giữ nguyên trạng thái đóng cửa (nhận `DENY`).

---

## 💻 Cách cài đặt và chạy hệ thống

### Bước 1: Nạp Code vào mạch ESP32
1. Kết nối mạch ESP32 vào máy tính.
2. Mở thư mục gốc của dự án `KNCN-BTL` bằng VS Code đã cài đặt Extension **PlatformIO**.
3. Tiến hành Build và Upload file `src/main.cpp` lên mạch ESP32 của bạn.
4. (Lưu ý: Bạn hãy kiểm tra xem ESP32 đang sử dụng cổng COM số mấy, ví dụ: `COM4`, `COM5`).

### Bước 2: Thiết lập Node.js Server
1. Mở cửa sổ Terminal (Command Prompt) chuyển vào thư mục web:
   ```bash
   cd webapp
   ```
2. Cài đặt các thư viện cần dùng (nếu chưa cài):
   ```bash
   npm install
   ```
3. Cấu hình cổng COM:
   Mở file `webapp/server.js` và cập nhật biến `SERIAL_PORT` thành tên cổng kết nối trên máy tính của bạn (cổng mà ban nãy bạn nạp lên ESP32).
   ```javascript
   const SERIAL_PORT = "COM4"; // Hãy chú ý thay đổi nếu máy của bạn là COM khác
   ```

### Bước 3: Chạy ứng dụng
1. Khi máy vẫn đang cắm dây USB với ESP32, hãy chạy Server bằng lệnh sau trong thư mục `webapp`:
   ```bash
   node server.js
   ```
   *Nhìn thấy `✅ MongoDB connected` và `✅ Serial opened on COMx` nghĩa là ứng dụng đã hoàn tất chạy.*
2. Mở trình duyệt web của bạn và dán đường dẫn: [http://localhost:3000](http://localhost:3000)
3. Bắt đầu thao tác quản lý, đăng ký thành viên trên màn hình Dashboard này. 

🎉 Chúc bạn vận hành dự án mô hình hệ thống Cổng Smart Gate thành công!
