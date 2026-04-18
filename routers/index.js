var express = require('express');
var router = express.Router();
var TranDau = require('../models/trandau');
var DonHang = require('../models/donhang');
var NguoiDung = require('../models/nguoidung');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// xử lý upload ảnh đại diện
// tạo thư mục lưu ảnh nếu chưa tồn tại
const dir = './public/images/avatars';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

// Cấu hình Multer: Đặt tên file ảnh không bị trùng
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/avatars')
    },
    filename: function (req, file, cb) {
        // Đặt tên file: IDUser-ThoiGian.jpg
        cb(null, req.session.MaNguoiDung + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });
// GET: Trang chủ
router.get('/', async (req, res) => {
    try {
        // Mặc định CHỈ TÌM các trận 'Sắp diễn ra'
        var dieuKienLoc = { TrangThai: 'Sắp diễn ra' };

        if (req.query.giaidau) {
            dieuKienLoc.GiaiDau = req.query.giaidau;
        }

        if (req.query.doi) {
            var danhSachDoiChon = Array.isArray(req.query.doi) ? req.query.doi : [req.query.doi];

            dieuKienLoc.$or = [
                { DoiNha: { $in: danhSachDoiChon } },
                { DoiKhach: { $in: danhSachDoiChon } }
            ];
        }

        // Lấy danh sách trận đấu
        var danhSachTranDau = await TranDau.find(dieuKienLoc)
            .sort({ Hot: -1, ThoiGian: 1 })
            .exec();

        // Chỉ lấy những giải đấu đang có trận 'Sắp diễn ra'
        var danhSachGiaiDau = await TranDau.distinct('GiaiDau', { TrangThai: 'Sắp diễn ra' }).exec();

        // Cập nhật điều kiện lấy đội bóng: Chỉ lấy các đội đang có lịch đá sắp tới
        var dieuKienLayDoi = { TrangThai: 'Sắp diễn ra' };
        if (req.query.giaidau) {
            dieuKienLayDoi.GiaiDau = req.query.giaidau; 
        }

        var cacDoiNha = await TranDau.distinct('DoiNha', dieuKienLayDoi).exec();
        var cacDoiKhach = await TranDau.distinct('DoiKhach', dieuKienLayDoi).exec();

        var danhSachDoiBong = [...new Set([...cacDoiNha, ...cacDoiKhach])].sort();

        var cacDoiDaChon = req.query.doi ? (Array.isArray(req.query.doi) ? req.query.doi : [req.query.doi]) : [];

        res.render('index', {
            title: 'Hệ Thống Đặt Vé Bóng Đá Châu Âu',
            trandau: danhSachTranDau,
            danhSachGiaiDau: danhSachGiaiDau,
            danhSachDoiBong: danhSachDoiBong,  
            giaidauDaChon: req.query.giaidau || '',
            doiDaChon: cacDoiDaChon            
        });

    } catch (error) {
        console.log(error);
        res.redirect('/');
    }
});

// ==========================================
// 2. CHI TIẾT TRẬN ĐẤU & CHỌN VÉ
// ==========================================
router.get('/trandau/chitiet/:id', async (req, res) => {
    try {
        var idTran = req.params.id;
        var tranDau = await TranDau.findById(idTran).exec();

        // Nếu không tìm thấy trận đấu hoặc URL bị sai, đẩy về trang chủ
        if (!tranDau) {
            return res.redirect('/');
        }

        res.render('chitiet', {
            title: `${tranDau.DoiNha} vs ${tranDau.DoiKhach} - Đặt Vé`,
            td: tranDau
        });
    } catch (error) {
        console.log(error);
        res.redirect('/');
    }
});

// ==========================================
// KHO VÉ CỦA TÔI (HIỂN THỊ VÉ ĐÃ MUA & TỰ ĐỘNG CẬP NHẬT QUÁ HẠN)
// ==========================================
router.get('/nguoidung/kho-ve', async (req, res) => {
    try {
        if (!req.session.MaNguoiDung) {
            return res.redirect('/auth/dangnhap');
        }

        var danhSachDonHang = await DonHang.find({ NguoiDung: req.session.MaNguoiDung })
            .populate('TranDau')
            .sort({ NgayMua: -1 })
            .exec();

        var thoiGianHienTai = new Date();

        // LOGIC TỰ ĐỘNG CẬP NHẬT VÉ QUÁ HẠN
        for (let dh of danhSachDonHang) {
            if (dh.TranDau) {
                let gioDa = new Date(dh.TranDau.ThoiGian);
                let coThayDoi = false;

                // Nếu thời gian hiện tại đã vượt qua giờ đá
                if (thoiGianHienTai > gioDa) {
                    // Duyệt qua từng vé trong đơn hàng
                    for (let ve of dh.DanhSachMaVe) {
                        // Chỉ đổi những vé chưa xé. Nếu đã dùng rồi thì giữ nguyên.
                        if (ve.TrangThai === 'Chưa sử dụng') {
                            ve.TrangThai = 'Quá hạn';
                            coThayDoi = true;
                        }
                    }
                }

                // Nếu có vé bị chuyển sang quá hạn thì lưu lại vào Database ngay lập tức
                if (coThayDoi) {
                    await dh.save();
                }
            }
        }

        res.render('khove', {
            title: 'Kho Vé Của Tôi',
            donHang: danhSachDonHang
        });

    } catch (error) {
        console.log(error);
        res.redirect('/');
    }
});
// ==========================================
// THÔNG TIN TÀI KHOẢN (PROFILE)
// ==========================================
// Hiển thị giao diện Profile
router.get('/nguoidung/profile', async (req, res) => {
    if (!req.session.MaNguoiDung) return res.redirect('/auth/dangnhap');
    
    try {
        var user = await NguoiDung.findById(req.session.MaNguoiDung);
        res.render('profile', { title: 'Thông tin tài khoản', user: user });
    } catch (error) {
        res.redirect('/');
    }
});

// Xử lý cập nhật thông tin & Upload Avatar
// Chú ý: upload.single('Avatar') để bắt file ảnh từ form gửi lên
router.post('/nguoidung/profile', upload.single('Avatar'), async (req, res) => {
    if (!req.session.MaNguoiDung) return res.redirect('/auth/dangnhap');
    
    try {
        var user = await NguoiDung.findById(req.session.MaNguoiDung);
        
        // Cập nhật thông tin text
        user.HoVaTen = req.body.HoVaTen;
        user.SoDienThoai = req.body.SoDienThoai;
        
        // NẾU CÓ UPLOAD ẢNH MỚI
        if (req.file) {
            user.Avatar = '/images/avatars/' + req.file.filename;
            req.session.Avatar = user.Avatar; // Cập nhật lại session để đổi ảnh trên Header
        }
        
        await user.save();
        
        // Cập nhật lại tên trong session lỡ khách có đổi tên
        req.session.HoVaTen = user.HoVaTen;
        
        res.send("<script>alert('Cập nhật thông tin thành công!'); window.location.href='/nguoidung/profile';</script>");
    } catch (error) {
        console.log(error);
        res.send("<script>alert('Có lỗi xảy ra khi cập nhật!'); window.history.back();</script>");
    }
});
module.exports = router;