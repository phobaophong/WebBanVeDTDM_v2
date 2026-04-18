var mongoose = require('mongoose');

var tranDauSchema = new mongoose.Schema({
    DoiNha: { type: String, required: true },
    LogoNha: { type: String },
    DoiKhach: { type: String, required: true },
    LogoKhach: { type: String },
    SanVanDong: { type: String, required: true },
    SucChua: { type: Number, default: 0 },
    GiaiDau: { type: String, required: true }, 
    VongDau: { type: String },                 
    ThoiGian: { type: Date, required: true },  
    HinhAnh: { type: String },
    TrangThai: { type: String, default: 'Sắp diễn ra' }, 
    Hot: { type: Boolean, default: false },            
    HangVe: [{
        TenHang: { type: String, required: true },       
        GiaTien: { type: Number, required: true },
        SoLuong: { type: Number, required: true },       
        SoLuongCon: { type: Number, required: true }     
    }]
});

var tranDauModel = mongoose.model('TranDau', tranDauSchema);

module.exports = tranDauModel;