var express = require('express');
var router = express.Router();
var NguoiDung = require('../models/nguoidung');

// Middleware kiểm tra đăng nhập
var checkAuth = (req, res, next) => {
    if (req.session.MaNguoiDung) return next();
    res.redirect('/auth/dangnhap');
};

// Hiển thị trang nạp tiền
router.get('/', checkAuth, async (req, res) => {
    var user = await NguoiDung.findById(req.session.MaNguoiDung);
    res.render('naptien', { 
        title: 'Nạp tiền vào tài khoản',
        user: user
    });
});

// Xử lý nạp tiền (Fake Payment)
router.post('/xuly', checkAuth, async (req, res) => {
    try {
        var soTienNap = parseInt(req.body.soTien);
        
        if (isNaN(soTienNap) || soTienNap <= 0) {
            return res.send("Số tiền nạp không hợp lệ!");
        }

        // Tìm user và cộng tiền
        var user = await NguoiDung.findById(req.session.MaNguoiDung);
        user.SoDu += soTienNap;
        await user.save();

        // Cập nhật lại tiền trong Session để Navbar nhảy số ngay
        req.session.SoDu = user.SoDu;

        // Chuyển hướng về trang nạp tiền kèm thông báo thành công (giả lập)
        res.send(`
            <script>
                alert('Nạp thành công ${soTienNap.toLocaleString()}đ vào tài khoản!');
                window.location.href = '/naptien';
            </script>
        `);
    } catch (error) {
        console.log(error);
        res.send("Lỗi hệ thống khi nạp tiền!");
    }
});

module.exports = router;