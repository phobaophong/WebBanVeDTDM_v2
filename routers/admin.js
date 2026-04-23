var express = require('express');
var router = express.Router();
var TranDau = require('../models/trandau');
var NguoiDung = require('../models/nguoidung');
var DonHang = require('../models/donhang');
var axios = require('axios');

var kiemTraAdmin = (req, res, next) => {
    if (req.session.MaNguoiDung && req.session.QuyenHan === 'admin') {
        next();
    } else {
        req.session.error = 'Bạn không có quyền truy cập trang quản trị!';
        res.redirect('/auth/dangnhap');
    }
};
router.use(kiemTraAdmin);

// bảng điều khiển thốg kê (mặc định khi vào /admin sẽ hiển thị trang này)
router.get('/', async (req, res) => {
    try {
        // dữ liệu tổng quan
        var tongTran = await TranDau.countDocuments();
        var tongNguoiDung = await NguoiDung.countDocuments({ QuyenHan: { $ne: 'admin' } });
        var cacDonHang = await DonHang.find().exec();
        var tongDoanhThu = 0;
        var tongVe = 0;

        cacDonHang.forEach(dh => {
            tongDoanhThu += dh.TongTien;
            tongVe += dh.SoLuong;
        });

        // biểu đồ doanh thu 7 ngày gần nhất (cột)
        var labels7Ngay = [];
        var data7Ngay = [0, 0, 0, 0, 0, 0, 0];
        var homNay = new Date();
        
        // mảng 7 ngày
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(homNay.getDate() - i);
            labels7Ngay.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
        }

        // lọc đơn hàng 7 ngày gần nhất
        var donHang7Ngay = await DonHang.find({
            NgayMua: { $gte: new Date(new Date().setDate(homNay.getDate() - 7)) }
        });

        donHang7Ngay.forEach(dh => {
            let dateStr = new Date(dh.NgayMua).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            let idx = labels7Ngay.indexOf(dateStr);
            if(idx !== -1) {
                data7Ngay[idx] += dh.TongTien;
            }
        });

        // biểu đồ tròn
        var thongKeGiaiDau = await TranDau.aggregate([
            { $group: { _id: "$GiaiDau", count: { $sum: 1 } } }
        ]);
        var labelsGiaiDau = thongKeGiaiDau.map(item => item._id);
        var dataGiaiDau = thongKeGiaiDau.map(item => item.count);

        // bảng trận đấu hot
        var tranHot = await TranDau.find({ TrangThai: 'Sắp diễn ra' })
            .sort({ Hot: -1, ThoiGian: 1 })
            .limit(5);

        // đổ ra dashboard
        res.render('../admin/index', {
            title: 'Bảng Điều Khiển (Dashboard)',
            tongTran: tongTran,
            tongNguoiDung: tongNguoiDung,
            tongDoanhThu: tongDoanhThu,
            tongVe: tongVe,
            labels7Ngay: JSON.stringify(labels7Ngay),
            data7Ngay: JSON.stringify(data7Ngay),
            labelsGiaiDau: JSON.stringify(labelsGiaiDau),
            dataGiaiDau: JSON.stringify(dataGiaiDau),
            tranHot: tranHot
        });
    } catch (error) {
        console.log(error);
        res.send('Lỗi tải Dashboard!');
    }
});
// thêm trận
router.get('/themtran', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau; 
        var trandauDb = []; 

        var danhSachGiaiDau = ['Ngoại hạng Anh', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

        if (giaidauDaChon) {
            trandauDb = await TranDau.find({ GiaiDau: giaidauDaChon }).sort({ ThoiGian: -1 }).exec();
        }

        res.render('../admin/themtran', {
            title: 'Kéo dữ liệu Trận đấu',
            danhSachGiaiDau: danhSachGiaiDau,
            giaidauDaChon: giaidauDaChon,
            trandauDb: trandauDb
        });
    } catch (error) {
        console.log(error);
        res.send('Lỗi khi tải trang Thêm trận đấu');
    }
});

var mapSucChua = {
    'Old Trafford': 74310,
    'Emirates Stadium': 60704,
    'Anfield': 61276,
    'Etihad Stadium': 53400,
    'Stamford Bridge': 40341,
    'Tottenham Hotspur Stadium': 62850,
    'St. James\' Park': 52305,
    'Villa Park': 42682,
    'Goodison Park': 39572,
    'London Stadium': 62500,
    'Mặc định': 30000 // nếu không có 
};

// api thêm trận
router.get('/api-fetch', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau;
        var vongToiDa = parseInt(req.query.vongToiDa); 

        if (!giaidauDaChon) return res.redirect('/admin/themtran');

        var maxRoundLimit = 38;
        if (giaidauDaChon === 'Bundesliga' || giaidauDaChon === 'Ligue 1') {
            maxRoundLimit = 34;
        }
        
        if (vongToiDa > maxRoundLimit) {
            vongToiDa = maxRoundLimit;
        }

        var mapGiaiDau = {
            'Ngoại hạng Anh': 39,
            'La Liga': 140,
            'Serie A': 135,
            'Bundesliga': 78,
            'Ligue 1': 61
        };

        var leagueId = mapGiaiDau[giaidauDaChon];

        if (!leagueId) {
            req.session.error = 'Chưa hỗ trợ giải này.';
            return res.redirect('/admin/themtran');
        }

        // kiểm tra vòng đấu hiện tại của giải đấu đã chọn
        var cacTran = await TranDau.find({ GiaiDau: giaidauDaChon }).exec();
        var maxVong = 0;

        cacTran.forEach(t => {
            if (t.VongDau) {
                var m = t.VongDau.match(/\d+/);
                if (m) {
                    var num = parseInt(m[0]);
                    if (num > maxVong) maxVong = num;
                }
            }
        });

        var configAPI = {
            method: 'get',
            url: 'https://v3.football.api-sports.io/fixtures', 
            params: {
                league: leagueId,
                season: 2024 
            },
            headers: {
                'x-apisports-key': '24c0537e571e37887a6fab4415f245d2'// key
            }
        };

        if (maxVong > 0) {
            configAPI.params.round = `Regular Season - ${maxVong + 1}`;
        }

        var response = await axios(configAPI);
        var danhSachTranApi = response.data.response;

        if (!danhSachTranApi || danhSachTranApi.length === 0) {
            req.session.error = 'Không có dữ liệu API.';
            return res.redirect('/admin/themtran');
        }

        if (maxVong === 0) {
            var limitRound = (vongToiDa && vongToiDa > 0) ? vongToiDa : 1; 

            danhSachTranApi = danhSachTranApi.filter(match => {
                if (!match.league.round) return false;

                var m = match.league.round.match(/\d+/);
                if (!m) return false;

                var round = parseInt(m[0]);
                return round <= limitRound; // Lọc tất cả các trận có vòng <= số admin nhập
            });
        }


        var now = new Date();
        var duLieuInsert = [];

        for (let match of danhSachTranApi) {
            var thoiGianGoc = new Date(match.fixture.date);

            // +1 năm
            var fakeDate = new Date(thoiGianGoc);
            fakeDate.setFullYear(fakeDate.getFullYear() + 1);

            // timezone VN
            fakeDate.setHours(fakeDate.getHours() + 7);

            var trangThaiHienTai = fakeDate > now ? 'Sắp diễn ra' : 'Đã kết thúc';

            var tenSan = match.fixture.venue.name || 'Đang cập nhật';
            var sucChuaSan = mapSucChua[tenSan] || mapSucChua['Mặc định'];

            var data = {
                DoiNha: match.teams.home.name,
                LogoNha: match.teams.home.logo,
                DoiKhach: match.teams.away.name,
                LogoKhach: match.teams.away.logo,
                SanVanDong: tenSan,
                SucChua: sucChuaSan,
                GiaiDau: giaidauDaChon,
                VongDau: match.league.round.replace('Regular Season - ', 'Vòng '),
                ThoiGian: fakeDate,
                TrangThai: trangThaiHienTai,
                Hot: false,
                HangVe: []
            };

            // chống trùng
            var exists = await TranDau.findOne({
                DoiNha: data.DoiNha,
                DoiKhach: data.DoiKhach,
                ThoiGian: data.ThoiGian
            });

            if (!exists) {
                duLieuInsert.push(data);
            }
        }

        // insert vào database
        if (duLieuInsert.length > 0) {
            await TranDau.insertMany(duLieuInsert);
        }

        res.redirect('/admin/themtran?giaidau=' + encodeURIComponent(giaidauDaChon));

    } catch (error) {
        console.log('Lỗi API:', error.message);
        req.session.error = 'Lỗi gọi API.';
        res.redirect('/admin/themtran');
    }
});
// thay đổi trạng thái nổi bật
router.post('/trandau/toggle-hot/:id', async (req, res) => {
    try {
        // Nếu lúc gửi form có kèm tên giải đấu, ta sẽ nối nó vào link chuyển hướng
        let linkChuyenHuong = '/admin/themtran';
        if (req.query.giaidau) {
            linkChuyenHuong += '?giaidau=' + req.query.giaidau;
        }

        const TranDau = require('../models/trandau');
        const match = await TranDau.findById(req.params.id);

        if (!match) {
            req.session.error = "Không tìm thấy trận đấu!";
            return res.redirect(linkChuyenHuong); // Dùng link thông minh
        }

        match.Hot = !match.Hot;
        await match.save();

        const statusText = match.Hot ? "Đã bật trạng thái Nổi bật!" : "Đã tắt trạng thái Nổi bật!";
        req.session.success = statusText;
        
        req.session.save(() => {
            res.redirect(linkChuyenHuong); // Dùng link thông minh
        });

    } catch (error) {
        console.log(error);
        req.session.error = "Có lỗi xảy ra khi cập nhật trạng thái!";
        
        let linkLoi = '/admin/themtran';
        if (req.query.giaidau) linkLoi += '?giaidau=' + req.query.giaidau;
        res.redirect(linkLoi);
    }
});
// tạo vé
router.get('/taove', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau;
        var trandauDb = [];
        var danhSachGiaiDau = ['Ngoại hạng Anh', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

        if (giaidauDaChon) {
            trandauDb = await TranDau.find({ GiaiDau: giaidauDaChon }).sort({ ThoiGian: -1 }).exec();
        }

        res.render('../admin/taove', {
            title: 'Quản lý Tạo vé',
            danhSachGiaiDau: danhSachGiaiDau,
            giaidauDaChon: giaidauDaChon,
            trandauDb: trandauDb
        });
    } catch (error) {
        console.log(error);
        res.redirect('/admin');
    }
});
// tạo vé thủ công cho 1 trận
router.post('/taove-thucong/:id', async (req, res) => {
    try {
        var idTran = req.params.id;
        var giaidauDaChon = req.query.giaidau;
        var tranDau = await TranDau.findById(idTran).exec();

        // lấy và ép kiểu số lượng vé từ form
        var slVIP = parseInt(req.body.slVIP);
        var slA = parseInt(req.body.slA);
        var slB = parseInt(req.body.slB);
        var slC = parseInt(req.body.slC);
        var slD = parseInt(req.body.slD);

        if (tranDau && tranDau.TrangThai === 'Sắp diễn ra') {
            tranDau.HangVe = [
                { TenHang: 'VIP (Phòng kính)', GiaTien: parseInt(req.body.giaVIP), SoLuong: slVIP, SoLuongCon: slVIP },
                { TenHang: 'Khán đài A', GiaTien: parseInt(req.body.giaA), SoLuong: slA, SoLuongCon: slA },
                { TenHang: 'Khán đài B', GiaTien: parseInt(req.body.giaB), SoLuong: slB, SoLuongCon: slB },
                { TenHang: 'Khán đài C', GiaTien: parseInt(req.body.giaC), SoLuong: slC, SoLuongCon: slC },
                { TenHang: 'Khán đài D', GiaTien: parseInt(req.body.giaD), SoLuong: slD, SoLuongCon: slD }
            ];
            
            await tranDau.save();
        }
        
   
        res.redirect('/admin/taove?giaidau=' + encodeURIComponent(giaidauDaChon));

    } catch (error) {
        console.log(error);
        res.redirect('/admin/taove');
    }
});
// tạo vé nhanh cho 1 trận cụ thể
router.get('/taovenhanh/:id', async (req, res) => {
    try {
        var idTran = req.params.id;
        var tranDau = await TranDau.findById(idTran).exec();

        if (tranDau && tranDau.HangVe.length === 0 && tranDau.TrangThai === 'Sắp diễn ra') {
            var tongVeChoPhep = Math.floor(tranDau.SucChua * 0.3);
            var slVIP = Math.floor(tongVeChoPhep * 0.05);
            var slA = Math.floor(tongVeChoPhep * 0.20);
            var slB = Math.floor(tongVeChoPhep * 0.25);
            var slC = Math.floor(tongVeChoPhep * 0.25);
            var slD = tongVeChoPhep - (slVIP + slA + slB + slC);

            tranDau.HangVe = [
                { TenHang: 'VIP (Phòng kính)', GiaTien: 5000000, SoLuong: slVIP, SoLuongCon: slVIP },
                { TenHang: 'Khán đài A', GiaTien: 3000000, SoLuong: slA, SoLuongCon: slA },
                { TenHang: 'Khán đài B', GiaTien: 2000000, SoLuong: slB, SoLuongCon: slB },
                { TenHang: 'Khán đài C', GiaTien: 1000000, SoLuong: slC, SoLuongCon: slC },
                { TenHang: 'Khán đài D', GiaTien: 500000, SoLuong: slD, SoLuongCon: slD }
            ];
            await tranDau.save();

            res.redirect('/admin/taove?giaidau=' + encodeURIComponent(tranDau.GiaiDau));
        } else {
            res.redirect('/admin/taove');
        }
    } catch (error) {
        console.log(error);
        res.redirect('/admin/taove');
    }
});

// tạo hàng loạt
router.get('/taove-hangloat', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau;
        if (!giaidauDaChon) return res.redirect('/admin/taove');

        var cacTranChuaCoVe = await TranDau.find({ GiaiDau: giaidauDaChon, HangVe: { $size: 0 }, TrangThai: 'Sắp diễn ra' }).exec();

        for (let tranDau of cacTranChuaCoVe) {
            let tongVeChoPhep = Math.floor(tranDau.SucChua * 0.3);
            let slVIP = Math.floor(tongVeChoPhep * 0.05);
            let slA = Math.floor(tongVeChoPhep * 0.20);
            let slB = Math.floor(tongVeChoPhep * 0.25);
            let slC = Math.floor(tongVeChoPhep * 0.25);
            let slD = tongVeChoPhep - (slVIP + slA + slB + slC);

            tranDau.HangVe = [
                { TenHang: 'VIP (Phòng kính)', GiaTien: 5000000, SoLuong: slVIP, SoLuongCon: slVIP },
                { TenHang: 'Khán đài A', GiaTien: 3000000, SoLuong: slA, SoLuongCon: slA },
                { TenHang: 'Khán đài B', GiaTien: 2000000, SoLuong: slB, SoLuongCon: slB },
                { TenHang: 'Khán đài C', GiaTien: 1000000, SoLuong: slC, SoLuongCon: slC },
                { TenHang: 'Khán đài D', GiaTien: 500000, SoLuong: slD, SoLuongCon: slD }
            ];
            await tranDau.save();
        }
        res.redirect('/admin/taove?giaidau=' + encodeURIComponent(giaidauDaChon));
    } catch (error) {
        console.log(error);
        res.redirect('/admin/taove');
    }
});
// quản lý đơn hàng (get)
router.get('/donhang', async (req, res) => {
    try {
        var danhSachDonHang = await DonHang.find()
            .populate('NguoiDung')
            .populate('TranDau')
            .sort({ NgayMua: -1 })
            .exec();

        res.render('../admin/donhang', {
            title: 'Quản lý Đơn hàng',
            donHang: danhSachDonHang
        });
    } catch (error) {
        console.log(error);
        res.send('Lỗi khi tải trang Quản lý đơn hàng');
    }
});
// quản lý người dùng (get)
router.get('/nguoidung', async (req, res) => {
    try {
        var danhSachNguoiDung = await NguoiDung.find({ QuyenHan: { $ne: 'admin' } }).sort({ _id: -1 });

        res.render('../admin/nguoidung', {
            title: 'Quản lý Tài khoản',
            danhSachNguoiDung: danhSachNguoiDung
        });
    } catch (error) {
        console.log(error);
        res.send('Lỗi khi tải trang Quản lý người dùng');
    }
});
// mở khóa / khóa người dùng (post)
router.get('/nguoidung/toggle-status/:id', async (req, res) => {
    try {
        var user = await NguoiDung.findById(req.params.id);
        if (user && user.QuyenHan !== 'admin') {
            // Đảo ngược trạng thái hiện tại
            user.TrangThai = !user.TrangThai; 
            await user.save();
        }
        res.redirect('/admin/nguoidung');
    } catch (error) {
        res.redirect('/admin/nguoidung');
    }
});

// quét qr
router.get('/quetve', async (req, res) => {
    res.render('../admin/quetve', { title: 'Soát Vé Cổng' });
});

// xử lý mã qr
router.post('/quetve/xuly', async (req, res) => {
    try {
        var maCode = req.body.maCode;

        var donHang = await DonHang.findOne({ "DanhSachMaVe.MaCode": maCode })
            .populate('TranDau')
            .populate('NguoiDung');
        // giả
        if (!donHang) {
            return res.json({ success: false, message: 'Vé giả hoặc không tồn tại trên hệ thống!' });
        }

        // lấy thông tin vé từ đơn hàng
        var ve = donHang.DanhSachMaVe.find(v => v.MaCode === maCode);

        // kiêm tra trạng thái vé
        if (ve.TrangThai === 'Chưa sử dụng') {
            
            ve.TrangThai = 'Đã sử dụng';
            donHang.markModified('DanhSachMaVe'); 
            await donHang.save();

            return res.json({
                success: true, 
                message: 'HỢP LỆ! Mời khách qua cổng.',
                khachHang: donHang.NguoiDung.HoVaTen,
                loaiVe: donHang.TenHangVe,
                tranDau: `${donHang.TranDau.DoiNha} vs ${donHang.TranDau.DoiKhach}`
            });

        } else if (ve.TrangThai === 'Đã sử dụng') {
            return res.json({ success: false, message: 'CẢNH BÁO: Vé này đã được quét qua cổng trước đó!' });
            
        } else if (ve.TrangThai === 'Quá hạn') {
            return res.json({ success: false, message: 'TỪ CHỐI: Vé đã quá hạn, trận đấu đã kết thúc!' });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: 'Lỗi máy chủ!' });
    }
});
module.exports = router;