var express = require('express');
var router = express.Router();
var TranDau = require('../models/trandau');
var DonHang = require('../models/donhang');
var NguoiDung = require('../models/nguoidung');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dir = './public/images/avatars';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/avatars')
    },
    filename: function (req, file, cb) {
        cb(null, req.session.MaNguoiDung + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });
// GET: Trang chủ
router.get('/', async (req, res) => {
    try {
        // tìm trận đấu đang sắp diễn ra
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

        var danhSachTranDau = await TranDau.find(dieuKienLoc)
            .sort({ Hot: -1, ThoiGian: 1 })
            .exec();

        var danhSachGiaiDau = await TranDau.distinct('GiaiDau', { TrangThai: 'Sắp diễn ra' }).exec();

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

// chi tiết trận đấu
router.get('/trandau/chitiet/:id', async (req, res) => {
    try {
        var idTran = req.params.id;
        var tranDau = await TranDau.findById(idTran).exec();

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

// kho vé
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

        // tự động cập nhật quá hạn cho vé nếu đã qua giờ đá
        for (let dh of danhSachDonHang) {
            if (dh.TranDau) {
                let gioDa = new Date(dh.TranDau.ThoiGian);
                let coThayDoi = false;

                if (thoiGianHienTai > gioDa) {
                    for (let ve of dh.DanhSachMaVe) {
                        if (ve.TrangThai === 'Chưa sử dụng') {
                            ve.TrangThai = 'Quá hạn';
                            coThayDoi = true;
                        }
                    }
                }

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
// profile
router.get('/nguoidung/profile', async (req, res) => {
    if (!req.session.MaNguoiDung) return res.redirect('/auth/dangnhap');
    
    try {
        var user = await NguoiDung.findById(req.session.MaNguoiDung);
        res.render('profile', { title: 'Thông tin tài khoản', user: user });
    } catch (error) {
        res.redirect('/');
    }
});

// xử lý cập nhật thông tin tài khoản
router.post('/nguoidung/profile', upload.single('Avatar'), async (req, res) => {
    if (!req.session.MaNguoiDung) return res.redirect('/auth/dangnhap');
    
    try {
        var user = await NguoiDung.findById(req.session.MaNguoiDung);
        
        user.HoVaTen = req.body.HoVaTen;
        user.SoDienThoai = req.body.SoDienThoai;
        
        if (req.file) {
            user.Avatar = '/images/avatars/' + req.file.filename;
            req.session.Avatar = user.Avatar; 
        }
        
        await user.save();

        req.session.HoVaTen = user.HoVaTen;
        
        res.send("<script>alert('Cập nhật thông tin thành công!'); window.location.href='/nguoidung/profile';</script>");
    } catch (error) {
        console.log(error);
        res.send("<script>alert('Có lỗi xảy ra khi cập nhật!'); window.history.back();</script>");
    }
});
module.exports = router;