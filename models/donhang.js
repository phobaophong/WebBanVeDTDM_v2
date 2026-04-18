var mongoose = require('mongoose');

var donHangSchema = new mongoose.Schema({
    NguoiDung: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
    TranDau: { type: mongoose.Schema.Types.ObjectId, ref: 'TranDau' },
    TenHangVe: { type: String, required: true },
    SoLuong: { type: Number, required: true },
    TongTien: { type: Number, required: true },
    DanhSachMaVe: [{
        MaCode: { type: String, required: true },
        TrangThai: { type: String, default: 'Chưa sử dụng' } // Mặc định khi mua xong là chưa dùng
    }],
    NgayMua: { type: Date, default: Date.now }
});

var donHangModel = mongoose.model('DonHang', donHangSchema);

module.exports = donHangModel;