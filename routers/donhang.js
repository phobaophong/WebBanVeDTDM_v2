var express = require('express');
var router = express.Router();
var TranDau = require('../models/trandau');
var NguoiDung = require('../models/nguoidung');
var DonHang = require('../models/donhang');

// kiểm tra đăng nhập
var kiemTraDangNhap = (req, res, next) => {
    if (req.session && req.session.MaNguoiDung) {
        next();
    } else {
        res.redirect('/auth/dangnhap');
    }
};

// xử lý thanh toán
router.post('/thanhtoan', kiemTraDangNhap, async (req, res) => {
    try {
        var maNguoiDung = req.session.MaNguoiDung;
        var MaTranDau = req.body.MaTranDau;
        var TenHangVe = req.body.TenHangVe;
        var SoLuongMua = parseInt(req.body.SoLuongMua);

        var user = await NguoiDung.findById(maNguoiDung);
        var match = await TranDau.findById(MaTranDau);

        if (!match || match.TrangThai !== 'Sắp diễn ra') {
            return res.send('Trận đấu không tồn tại hoặc đã dừng bán vé!');
        }

        var veIndex = match.HangVe.findIndex(v => v.TenHang === TenHangVe);
        if (veIndex === -1) return res.send('Hạng vé không hợp lệ!');
        
        var veChon = match.HangVe[veIndex];
        var tongTien = veChon.GiaTien * SoLuongMua;

        if (veChon.SoLuongCon < SoLuongMua) {
            return res.send(`Rất tiếc! Hạng vé này chỉ còn ${veChon.SoLuongCon} chỗ.`);
        }

    
        if (user.SoDu < tongTien) {
            return res.send(`<script>alert('Tài khoản không đủ! Cần ${tongTien.toLocaleString('vi-VN')}đ để thanh toán.'); window.history.back();</script>`);
        }

        user.SoDu -= tongTien;
        
        match.HangVe[veIndex].SoLuongCon -= SoLuongMua;

        var mangMaQR = [];
        for (let i = 0; i < SoLuongMua; i++) {
            let maCode = 'TICK-' + Math.floor(10000000 + Math.random() * 90000000); 

            mangMaQR.push({
                MaCode: maCode,
                TrangThai: 'Chưa sử dụng'
            }); 
        }

        var donHangMoi = new DonHang({
            NguoiDung: user._id,
            TranDau: match._id,
            TenHangVe: TenHangVe,
            SoLuong: SoLuongMua,
            TongTien: tongTien,
            DanhSachMaVe: mangMaQR, 
            NgayMua: new Date()
        });

        await user.save();
        await match.save();
        await donHangMoi.save();

        req.session.SoDu = user.SoDu;

        res.redirect('/nguoidung/kho-ve');

    } catch (error) {
        console.log("Lỗi thanh toán:", error);
        res.send('Đã xảy ra lỗi trong quá trình thanh toán!');
    }
});


module.exports = router;