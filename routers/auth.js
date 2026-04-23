var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');

var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;
var NguoiDung = require('../models/nguoidung');

// api google
passport.use(new GoogleStrategy({
    clientID: '51334060724-iotk0ov11rsaqg4o446to24k7nrnb5vs.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: "https://webbanvedtdm-v2.onrender.com/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, cb) {
        try {
            let user = await NguoiDung.findOne({ GoogleId: profile.id });
            if (user) return cb(null, user);

            let email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

            if (email) {
                user = await NguoiDung.findOne({ Email: email });
                if (user) {
                    user.GoogleId = profile.id;
                    await user.save();
                    return cb(null, user);
                }
            }

            let newUser = new NguoiDung({
                GoogleId: profile.id,
                HoVaTen: profile.displayName,
                Email: email,
                TenDangNhap: email ? email.split('@')[0] + '_' + Math.floor(Math.random() * 1000) : 'user_' + profile.id,
                SoDu: 0,
                QuyenHan: 'nguoidung',
                TrangThai: true
            });
            await newUser.save();
            return cb(null, newUser);
        } catch (err) {
            return cb(err, null);
        }
    }
));

// đăng ký
router.get('/dangky', (req, res) => {
    res.render('dangky', { title: 'Đăng ký tài khoản', session: req.session });
});

// đăng ký tài khoản mới
router.post('/dangky', async (req, res) => {
    try {
        // mật khẩu xác nhận
        if (req.body.MatKhau !== req.body.XacNhanMatKhau) {
            req.session.error = 'Mật khẩu xác nhận không khớp! Vui lòng nhập lại.';
            return req.session.save(() => { res.redirect('/auth/dangky') });
        }

        // kiêm tra email 
        if (req.body.Email) {
            var emailDaTonTai = await NguoiDung.findOne({ Email: req.body.Email });
            if (emailDaTonTai) {
                req.session.error = 'Email này đã được đăng ký hoặc đang liên kết với Google! Vui lòng dùng Email khác.';
                return req.session.save(() => { res.redirect('/auth/dangky') });
            }
        }

        // kiểm tra Tên đăng nhập
        var userDaTonTai = await NguoiDung.findOne({ TenDangNhap: req.body.TenDangNhap });
        if (userDaTonTai) {
            req.session.error = 'Tên đăng nhập này đã có người sử dụng!';
            return req.session.save(() => { res.redirect('/auth/dangky') });
        }

        // tạo tài khoản
        var salt = bcrypt.genSaltSync(10);
        var duLieuNguoiDung = {
            HoVaTen: req.body.HoVaTen,
            Email: req.body.Email,
            TenDangNhap: req.body.TenDangNhap,
            SoDu: 0,
            MatKhau: bcrypt.hashSync(req.body.MatKhau, salt),
            TrangThai: true 
        };

        await NguoiDung.create(duLieuNguoiDung);
        req.session.success = 'Tạo tài khoản thành công! Mời bạn đăng nhập.';
        return req.session.save(() => { res.redirect('/auth/dangnhap') });

    } catch (error) {
        console.log(error);
        req.session.error = 'Có lỗi hệ thống xảy ra khi đăng ký.';
        return req.session.save(() => { res.redirect('/auth/dangky') });
    }
});

// đăng nhập
router.get('/dangnhap', (req, res) => {
    res.render('dangnhap', { title: 'Đăng nhập', session: req.session });
});

// đăng nhập bằng tài khoản đã tạo
router.post('/dangnhap', async (req, res) => {
    try {
        var user = await NguoiDung.findOne({ TenDangNhap: req.body.TenDangNhap }).exec();
        
        if (user) {
            if (user.TrangThai === false) {
                req.session.error = 'Tài khoản của bạn đã bị khóa!';
                return req.session.save(() => { res.redirect('/auth/dangnhap') });
            }

            if (bcrypt.compareSync(req.body.MatKhau, user.MatKhau)) {
                req.session.MaNguoiDung = user._id;
                req.session.HoVaTen = user.HoVaTen;
                req.session.QuyenHan = user.QuyenHan;
                req.session.SoDu = user.SoDu || 0;
                req.session.Avatar = user.Avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

                req.session.success = 'Chào mừng ' + user.HoVaTen + ' quay trở lại!';
                return req.session.save(() => { res.redirect('/') });
            } else {
                req.session.error = 'Mật khẩu không chính xác.';
                return req.session.save(() => { res.redirect('/auth/dangnhap') });
            }
        } else {
            req.session.error = 'Tên đăng nhập không tồn tại.';
            return req.session.save(() => { res.redirect('/auth/dangnhap') });
        }
    } catch (error) {
        req.session.error = 'Lỗi hệ thống khi đăng nhập.';
        return req.session.save(() => { res.redirect('/auth/dangnhap') });
    }
});

// đăng nhập bằng google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/dangnhap', session: false }),
  function(req, res) {
      if (req.user.TrangThai === false) {
          req.session.error = 'Tài khoản của bạn đã bị khóa!';
          return req.session.save(() => { res.redirect('/auth/dangnhap') });
      }

      req.session.MaNguoiDung = req.user._id;
      req.session.HoVaTen = req.user.HoVaTen;
      req.session.QuyenHan = req.user.QuyenHan;
      req.session.SoDu = req.user.SoDu || 0;
      req.session.Avatar = req.user.Avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
      
      return req.session.save(() => { res.redirect('/') });
  }
);

// đăng xuất
router.get('/dangxuat', (req, res) => {
    req.session.destroy(); 
    res.redirect('/');
});

// đổi mật khẩu
router.get('/doimatkhau', (req, res) => {
    if (!req.session.MaNguoiDung) {
        return res.redirect('/auth/dangnhap');
    }
    res.render('doimatkhau', { title: 'Đổi mật khẩu', session: req.session });
});

router.post('/doimatkhau', async (req, res) => {
    if (!req.session.MaNguoiDung) {
        return res.redirect('/auth/dangnhap');
    }

    try {
        var MatKhauCu = req.body.MatKhauCu;
        var MatKhauMoi = req.body.MatKhauMoi;
        var XacNhanMatKhau = req.body.XacNhanMatKhau;

        if (MatKhauMoi !== XacNhanMatKhau) {
            return res.send("<script>alert('Lỗi: Mật khẩu xác nhận không khớp!'); window.history.back();</script>");
        }

        var user = await NguoiDung.findById(req.session.MaNguoiDung);

        if (!bcrypt.compareSync(MatKhauCu, user.MatKhau)) {
            return res.send("<script>alert('Lỗi: Mật khẩu hiện tại không chính xác!'); window.history.back();</script>");
        }

        var salt = bcrypt.genSaltSync(10);
        user.MatKhau = bcrypt.hashSync(MatKhauMoi, salt);
        await user.save();

        res.send("<script>alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.'); window.location.href='/auth/dangxuat';</script>");

    } catch (error) {
        console.log(error);
        res.send("<script>alert('Có lỗi hệ thống xảy ra!'); window.history.back();</script>");
    }
});

module.exports = router;