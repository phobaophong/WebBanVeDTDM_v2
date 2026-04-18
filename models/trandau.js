var mongoose = require('mongoose');

var tranDauSchema = new mongoose.Schema({
    DoiNha: { type: String, required: true },
    LogoNha: { type: String },
    DoiKhach: { type: String, required: true },
    LogoKhach: { type: String },
    SanVanDong: { type: String, required: true },
    SucChua: { type: Number, default: 0 },
    GiaiDau: { type: String, required: true }, // Ví dụ: Ngoại hạng Anh, La Liga...
    VongDau: { type: String },                 // Ví dụ: Vòng 12, Vòng 13...
    ThoiGian: { type: Date, required: true },  // Dùng để so sánh thời gian thực khóa vé
    HinhAnh: { type: String },
    TrangThai: { type: String, default: 'Sắp diễn ra' }, // Sắp diễn ra, Đang đá, Đã kết thúc
    Hot: { type: Boolean, default: false },              // true: Trận cầu tâm điểm
    HangVe: [{
        TenHang: { type: String, required: true },       // VIP, Khán đài A, Khán đài B...
        GiaTien: { type: Number, required: true },
        SoLuong: { type: Number, required: true },       // Tổng vé mở bán
        SoLuongCon: { type: Number, required: true }     // Số vé còn lại để trừ dần
    }]
});

var tranDauModel = mongoose.model('TranDau', tranDauSchema);

module.exports = tranDauModel;