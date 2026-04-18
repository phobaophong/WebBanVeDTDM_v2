var express = require('express');
var router = express.Router();
var TranDau = require('../models/trandau');
var NguoiDung = require('../models/nguoidung');
var DonHang = require('../models/donhang');

// Middleware: Bắt buộc đăng nhập
var kiemTraDangNhap = (req, res, next) => {
    if (req.session && req.session.MaNguoiDung) {
        next();
    } else {
        res.redirect('/auth/dangnhap');
    }
};

// ==========================================
// XỬ LÝ MUA VÉ (TRỪ TIỀN VÀ XUẤT VÉ)
// ==========================================
router.post('/thanhtoan', kiemTraDangNhap, async (req, res) => {
    try {
        var maNguoiDung = req.session.MaNguoiDung;
        var MaTranDau = req.body.MaTranDau;
        var TenHangVe = req.body.TenHangVe;
        var SoLuongMua = parseInt(req.body.SoLuongMua);

        // 1. Lấy thông tin từ Database
        var user = await NguoiDung.findById(maNguoiDung);
        var match = await TranDau.findById(MaTranDau);

        if (!match || match.TrangThai !== 'Sắp diễn ra') {
            return res.send('Trận đấu không tồn tại hoặc đã dừng bán vé!');
        }

        // 2. Tìm chính xác Hạng vé khách muốn mua
        var veIndex = match.HangVe.findIndex(v => v.TenHang === TenHangVe);
        if (veIndex === -1) return res.send('Hạng vé không hợp lệ!');
        
        var veChon = match.HangVe[veIndex];
        var tongTien = veChon.GiaTien * SoLuongMua;

        // 3. KIỂM TRA ĐIỀU KIỆN (Tiền & Số lượng trống)
        if (veChon.SoLuongCon < SoLuongMua) {
            return res.send(`Rất tiếc! Hạng vé này chỉ còn ${veChon.SoLuongCon} chỗ.`);
        }

    
        if (user.SoDu < tongTien) {
            return res.send(`<script>alert('Tài khoản không đủ! Cần ${tongTien.toLocaleString('vi-VN')}đ để thanh toán.'); window.history.back();</script>`);
        }

        // 4. THỰC THI GIAO DỊCH
        // Trừ tiền trong ví
        user.SoDu -= tongTien;
        
        // Trừ số lượng vé trống của trận đấu
        match.HangVe[veIndex].SoLuongCon -= SoLuongMua;

        // TẠO VÒNG LẶP ĐỂ SINH MÃ QR DỰA TRÊN SỐ LƯỢNG MUA
        var mangMaQR = [];
        for (let i = 0; i < SoLuongMua; i++) {
            let maCode = 'TICK-' + Math.floor(10000000 + Math.random() * 90000000); 
            
            // SỬA Ở ĐÂY: Nhét một Object (gồm Mã và Trạng thái) thay vì chỉ nhét chữ
            mangMaQR.push({
                MaCode: maCode,
                TrangThai: 'Chưa sử dụng'
            }); 
        }

        // Khởi tạo 1 Đơn Hàng duy nhất chứa toàn bộ mã QR
        var donHangMoi = new DonHang({
            NguoiDung: user._id,
            TranDau: match._id,
            TenHangVe: TenHangVe,
            SoLuong: SoLuongMua,
            TongTien: tongTien,
            DanhSachMaVe: mangMaQR, // Đẩy nguyên cái mảng 5 mã vé vào đây
            NgayMua: new Date()
        });

        // 5. LƯU TOÀN BỘ VÀO DATABASE
        await user.save();
        await match.save();
        await donHangMoi.save();

        // Cập nhật lại Session để thanh Navbar hiển thị số tiền mới ngay lập tức
        req.session.SoDu = user.SoDu;

        // Chuyển hướng sang trang "Kho vé của tôi"
        res.redirect('/nguoidung/kho-ve');

    } catch (error) {
        console.log("Lỗi thanh toán:", error);
        res.send('Đã xảy ra lỗi trong quá trình thanh toán!');
    }
});


module.exports = router;