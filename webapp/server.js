const express = require("express");
const mongoose = require("mongoose");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;
const MONGO_URL =
  "mongodb+srv://kiettran05:16032005Kiet@cluster0.docqqrw.mongodb.net/?appName=Cluster0";
const SERIAL_PORT = "COM4"; //
const BAUD_RATE = 115200;

mongoose.connect(MONGO_URL).then(() => console.log("MongoDB connected"));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  uid: { type: String, required: true, unique: true },
  registeredAt: { type: Date, default: Date.now },
});
const User = mongoose.model("rfid_users", userSchema);

// ─── SERIAL BRIDGE ───────────────────────────────────────────────────────────
let serialPort = null;
let activeRegistration = null;

function initSerial() {
  try {
    serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

    serialPort.on("open", () => console.log(`Serial opened on ${SERIAL_PORT}`));
    serialPort.on("error", (err) =>
      console.error("Serial error:", err.message),
    );

    parser.on("data", async (line) => {
      line = line.trim();
      // ESP32 gửi: "UID:24EBE600"
      if (line.startsWith("UID:")) {
        const raw = line.slice(4);
        const uid = normalizeUID(raw);
        // 1. Nếu đang chờ đăng ký thẻ
        if (activeRegistration) {
          try {
            const user = await User.create({
              name: activeRegistration.name,
              uid,
            });
            activeRegistration.resolve(user);
            console.log(`Đã đăng ký thẻ mới: ${user.name}`);
          } catch (err) {
            if (err.code === 11000) {
              activeRegistration.reject(new Error(`Thẻ này đã được đăng ký`));
            } else {
              activeRegistration.reject(err);
            }
          }
          activeRegistration = null;
          serialPort.write("DENY\n"); // Không mở cổng trong lúc đăng ký
          return;
        }

        // 2. Chế độ hoạt động bình thường
        const user = await User.findOne({ uid });

        if (user) {
          console.log(`✅ Authorized: ${user.name}`);
          console.log(">>> SEND OPEN");
          serialPort.write("OPEN\n");
        } else {
          console.log(`❌ Denied: ${uid}`);
          console.log(">>> SEND DENY");
          serialPort.write("DENY\n");
        }
      } else if (line !== "") {
        // Hiển thị các tin nhắn khác từ ESP32 để xem nó đã nhận được lệnh chưa
        console.log(`[ESP32]: ${line}`);
      }
    });
  } catch (err) {
    console.warn(
      `Serial không khả dụng (${err.message}) — chạy không có Serial`,
    );
  }
}

function normalizeUID(uid) {
  return uid.toUpperCase().replace(/[:\s\-]/g, "");
}

// GET /api/users — danh sách toàn bộ người đăng ký
app.get("/api/users", async (req, res) => {
  const users = await User.find({ uid: { $exists: true } });
  res.json(users);
});

// POST /api/users — đăng ký thẻ (nếu có UID thì lưu luôn, nếu không thì chờ thẻ quét)
app.post("/api/users", async (req, res) => {
  const { name, uid } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: "Tên không được để trống" });
  }

  // Nếu nhập thủ công UID
  if (uid?.trim()) {
    const normalized = normalizeUID(uid);
    try {
      const user = await User.create({ name: name.trim(), uid: normalized });
      return res.status(201).json(user);
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(409)
          .json({ error: `UID ${normalized} đã được đăng ký` });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // Chế độ chờ quẹt thẻ
  if (!serialPort || !serialPort.isOpen) {
    return res.status(500).json({ error: "Chưa kết nối RFID hardware." });
  }

  // Huỷ cái cũ nếu có
  if (activeRegistration) {
    activeRegistration.reject(new Error("Bị hủy do yêu cầu mới"));
  }

  try {
    const user = await new Promise((resolve, reject) => {
      activeRegistration = { name: name.trim(), resolve, reject };

      // Chờ tối đa 30s
      setTimeout(() => {
        if (activeRegistration && activeRegistration.resolve === resolve) {
          activeRegistration = null;
          reject(new Error("Hết thời gian chờ quẹt thẻ (30s)"));
        }
      }, 30000);
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id — xóa người dùng
app.delete("/api/users/:id", async (req, res) => {
  const result = await User.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: "Không tìm thấy" });
  res.json({ ok: true });
});

app.post("/api/command", (req, res) => {
  const { cmd } = req.body;

  if (!serialPort || !serialPort.isOpen) {
    return res.status(500).json({ error: "Serial chưa sẵn sàng" });
  }

  serialPort.write(cmd + "\n");
  console.log(">>> SEND", cmd);

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  initSerial();
});
