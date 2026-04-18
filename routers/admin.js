var express = require('express');
var router = express.Router();


var TranDau = require('../models/trandau');
var NguoiDung = require('../models/nguoidung');
var DonHang = require('../models/donhang');

var kiemTraAdmin = (req, res, next) => {
    if (req.session.MaNguoiDung && req.session.QuyenHan === 'admin') {
        next();
    } else {
        req.session.error = 'Bạn không có quyền truy cập trang quản trị!';
        res.redirect('/auth/dangnhap');
    }
};

// ==========================================
// 1. DASHBOARD (Bảng điều khiển) - Đường dẫn: /admin/
// ==========================================
router.get('/', async (req, res) => {
    try {
        // Đếm số lượng từ DB
        var tongTran = await TranDau.countDocuments();
        var tongNguoiDung = await NguoiDung.countDocuments({ QuyenHan: 'user' });

        // Tính doanh thu và số vé
        var cacDonHang = await DonHang.find().exec();
        var tongDoanhThu = 0;
        var tongVe = 0;

        cacDonHang.forEach(dh => {
            tongDoanhThu += dh.TongTien;
            tongVe += dh.SoLuong;
        });

        // Trỏ đúng ra thư mục admin bên ngoài views
        res.render('../admin/index', {
            title: 'Bảng Điều Khiển (Dashboard)',
            tongTran: tongTran,
            tongNguoiDung: tongNguoiDung,
            tongDoanhThu: tongDoanhThu,
            tongVe: tongVe
        });
    } catch (error) {
        console.log(error);
        res.send('Lỗi tải Dashboard!');
    }
});

// ==========================================
// 2. QUẢN LÝ TRẬN ĐẤU
// ==========================================
router.get('/trandau', async (req, res) => {
    try {
        // Lấy danh sách trận đấu, trận nào đá sau thì xếp lên trước
        var danhSachTranDau = await TranDau.find().sort({ ThoiGian: -1 }).exec();

        res.render('../admin/trandau', {
            title: 'Quản lý Trận đấu',
            trandau: danhSachTranDau
        });
    } catch (error) {
        console.log(error);
        req.session.error = 'Lỗi truy xuất dữ liệu trận đấu.';
        res.redirect('/admin');
    }
});

// ==========================================
// 3. THÊM TRẬN ĐẤU MỚI (GIAO DIỆN KÉO API)
// ==========================================
router.get('/themtran', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau; // Lấy tên giải đấu từ thanh URL
        var trandauDb = []; // Mảng chứa các trận đang có trong DB

        // Danh sách các giải bạn muốn quản lý
        var danhSachGiaiDau = ['Ngoại hạng Anh', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

        if (giaidauDaChon) {
            // Nếu có chọn giải, tìm trong DB các trận thuộc giải này, xếp theo thời gian mới nhất
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

var axios = require('axios');
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
    'Mặc định': 30000 // Các sân nhỏ không có tên trong danh sách sẽ lấy số này
};

// ==========================================
// 4. GỌI API ĐỂ KÉO DỮ LIỆU (ĐỒNG BỘ THEO TỪNG GIẢI)
// ==========================================
router.get('/api-fetch', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau;
        if (!giaidauDaChon) return res.redirect('/admin/themtran');

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

        // =========================
        // 1. CHECK DB - XÁC ĐỊNH MAX VÒNG
        // =========================
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

        // =========================
        // 2. GỌI API
        // =========================
        var axios = require('axios');

        var configAPI = {
            method: 'get',
            url: 'https://v3.football.api-sports.io/fixtures',
            params: {
                league: leagueId,
                season: 2024 // free plan
            },
            headers: {
                'x-apisports-key': 'bcf3507c3e8b246a031d44e67a66e000'
            }
        };

        // 👉 Nếu đã có dữ liệu → chỉ lấy vòng tiếp theo
        if (maxVong > 0) {
            configAPI.params.round = `Regular Season - ${maxVong + 1}`;
        }

        var response = await axios(configAPI);
        var danhSachTranApi = response.data.response;

        if (!danhSachTranApi || danhSachTranApi.length === 0) {
            req.session.error = 'Không có dữ liệu API.';
            return res.redirect('/admin/themtran');
        }

        // =========================
        // 3. FILTER NẾU DB TRỐNG
        // =========================
        if (maxVong === 0) {
            var mapVongHienTai = {
                'Ngoại hạng Anh': 33,
                'La Liga': 31,
                'Serie A': 32,
                'Bundesliga': 29,
                'Ligue 1': 29
            };

            var vongToiDa = mapVongHienTai[giaidauDaChon] || 10;

            danhSachTranApi = danhSachTranApi.filter(match => {
                if (!match.league.round) return false;

                var m = match.league.round.match(/\d+/);
                if (!m) return false;

                var round = parseInt(m[0]);
                return round <= vongToiDa;
            });
        }

        // =========================
        // 4. XỬ LÝ DATA (+1 NĂM)
        // =========================
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
            'Mặc định': 30000
        };

        var now = new Date();
        var duLieuInsert = [];

        for (let match of danhSachTranApi) {
            var thoiGianGoc = new Date(match.fixture.date);

            // 👉 +1 năm
            var fakeDate = new Date(thoiGianGoc);
            fakeDate.setFullYear(fakeDate.getFullYear() + 1);

            // 👉 timezone VN
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

            // 👉 chống trùng
            var exists = await TranDau.findOne({
                DoiNha: data.DoiNha,
                DoiKhach: data.DoiKhach,
                ThoiGian: data.ThoiGian
            });

            if (!exists) {
                duLieuInsert.push(data);
            }
        }

        // =========================
        // 5. INSERT
        // =========================
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
// ==========================================
// 5. QUẢN LÝ TẠO VÉ (GIAO DIỆN CHỌN GIẢI ĐẤU)
// ==========================================
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

// Chế độ 1: Tạo vé cho 1 trận cụ thể
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

            // Sửa điểm chuyển hướng về lại trang taove đang chọn giải
            res.redirect('/admin/taove?giaidau=' + encodeURIComponent(tranDau.GiaiDau));
        } else {
            res.redirect('/admin/taove');
        }
    } catch (error) {
        console.log(error);
        res.redirect('/admin/taove');
    }
});

// Chế độ 2: Tạo vé hàng loạt (Chỉ tạo cho giải đấu đang được chọn)
router.get('/taove-hangloat', async (req, res) => {
    try {
        var giaidauDaChon = req.query.giaidau;
        if (!giaidauDaChon) return res.redirect('/admin/taove');

        // Bổ sung điều kiện chỉ tìm các trận trong giải đấu đang chọn
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
        // Lấy tất cả đơn hàng, sắp xếp mới nhất lên đầu
        // populate để lấy thông tin chi tiết từ bảng NguoiDung và TranDau
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
        // THAY ĐỔI Ở ĐÂY: Thêm điều kiện { QuyenHan: { $ne: 'admin' } }
        // $ne nghĩa là "Not Equal" (Không bằng). Nó sẽ lấy tất cả user TRỪ admin.
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

// ==========================================
// 8. QUÉT VÉ TẠI CỔNG (Dành cho Admin/Nhân viên)
// ==========================================

// Hiển thị giao diện Camera quét mã
router.get('/quetve', async (req, res) => {
    res.render('../admin/quetve', { title: 'Soát Vé Cổng' });
});

// API Nhận mã từ Camera và xử lý
router.post('/quetve/xuly', async (req, res) => {
    try {
        var maCode = req.body.maCode;

        // Tìm đơn hàng có chứa mã vé này
        var donHang = await DonHang.findOne({ "DanhSachMaVe.MaCode": maCode })
            .populate('TranDau')
            .populate('NguoiDung');

        // 1. NẾU MÃ VÉ LÀ GIẢ (Không có trong Database)
        if (!donHang) {
            return res.json({ success: false, message: 'Vé giả hoặc không tồn tại trên hệ thống!' });
        }

        // 2. Lôi chính xác tấm vé đó ra khỏi mảng
        var ve = donHang.DanhSachMaVe.find(v => v.MaCode === maCode);

        // 3. KIỂM TRA TRẠNG THÁI VÉ
        if (ve.TrangThai === 'Chưa sử dụng') {
            // Đổi trạng thái thành Đã sử dụng
            ve.TrangThai = 'Đã sử dụng';
            
            // Cú pháp bắt buộc của Mongoose khi sửa dữ liệu bên trong Mảng
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