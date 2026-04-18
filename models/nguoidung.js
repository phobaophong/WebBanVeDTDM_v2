var mongoose = require('mongoose');

var nguoiDungSchema = new mongoose.Schema({
    HoVaTen: { type: String, required: true },
    Email: { type: String },
    TenDangNhap: { type: String, unique: true, required: true },
    MatKhau: { type: String },
    GoogleId: { type: String },
    QuyenHan: { type: String, default: 'user' }, 
    SoDu: { type: Number, default: 0 },          
    TrangThai: { type: Boolean, default: true },      // true: Hoạt động, false: Bị khóa
    Avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }
});

var nguoiDungModel = mongoose.model('NguoiDung', nguoiDungSchema);

module.exports = nguoiDungModel;