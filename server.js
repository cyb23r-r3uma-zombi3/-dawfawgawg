const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const FILE_DU_LIEU = path.join(__dirname, 'du-lieu.json');

// Đọc dữ liệu đã lưu trên máy chủ
let db = { users: {}, collections: {} };
try {
    if (fs.existsSync(FILE_DU_LIEU)) {
        db = JSON.parse(fs.readFileSync(FILE_DU_LIEU, 'utf8'));
        if (!db.users) db.users = {};
        if (!db.collections) db.collections = {};
    }
} catch (e) {
    console.error('Khởi tạo kho dữ liệu mới:', e);
}

let henLuu = null;
function luuDuLieu() {
    clearTimeout(henLuu);
    henLuu = setTimeout(() => {
        try {
            fs.writeFileSync(FILE_DU_LIEU, JSON.stringify(db), 'utf8');
        } catch (e) {
            console.error('Lỗi lưu dữ liệu:', e);
        }
    }, 300);
}

// Trang kiểm tra máy chủ hoạt động
app.get('/', (req, res) => {
    res.send('May chu SkyEdu dang hoat dong!');
});

// ==========================================
// 1. API ĐỒNG BỘ TÀI KHOẢN (/api/users)
// ==========================================
app.get('/api/users', (req, res) => {
    res.json(Object.values(db.users));
});

app.post('/api/users', (req, res) => {
    const u = req.body;
    if (!u || !u.email) {
        return res.status(400).json({ error: 'Thieu email' });
    }
    db.users[u.email] = u;
    luuDuLieu();
    res.json({ ok: true });
});

app.delete('/api/users/:email', (req, res) => {
    const email = req.params.email;
    if (db.users[email]) {
        delete db.users[email];
        luuDuLieu();
    }
    res.json({ ok: true });
});

// ==========================================
// 2. API ĐỒNG BỘ DÙNG CHUNG (/api/c/:khoa)
// (de, kq, dot, ca, dk, ma...)
// ==========================================
app.get('/api/c/:khoa', (req, res) => {
    const khoa = req.params.khoa;
    const bang = db.collections[khoa] || {};
    res.json(Object.values(bang));
});

app.post('/api/c/:khoa', (req, res) => {
    const khoa = req.params.khoa;
    const item = req.body;
    const id = item && (item.id || item.ma);
    if (!id) {
        return res.status(400).json({ error: 'Thieu id' });
    }
    if (!db.collections[khoa]) {
        db.collections[khoa] = {};
    }
    db.collections[khoa][String(id)] = item;
    luuDuLieu();
    res.json({ ok: true });
});

app.delete('/api/c/:khoa/:id', (req, res) => {
    const { khoa, id } = req.params;
    if (db.collections[khoa] && db.collections[khoa][id]) {
        delete db.collections[khoa][id];
        luuDuLieu();
    }
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('May chu SkyEdu dang chay tai cong ' + PORT);
});
