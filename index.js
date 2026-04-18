var express = require('express');
var app = express();
var mongoose = require('mongoose');
var session = require('express-session');
var path = require('path');

var indexRouter = require('./routers/index');
var authRouter = require('./routers/auth');
var adminRouter = require('./routers/admin');
var donhangRouter = require('./routers/donhang');
var naptienRouter = require('./routers/naptien');



// kết nối cơ sở dữ liệu
var uri = 'mongodb://admin:134Tombeo@ac-mfdda22-shard-00-00.0i3vkst.mongodb.net:27017,ac-mfdda22-shard-00-01.0i3vkst.mongodb.net:27017,ac-mfdda22-shard-00-02.0i3vkst.mongodb.net:27017/banve_bongda_v2?ssl=true&replicaSet=atlas-6k7ljg-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(uri)
    .then(() => console.log('Đã kết nối MongoDB thành công! Database: banve_bongda_v2'))
    .catch(err => console.log('Lỗi kết nối DB:', err));

// cấu hình
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// session
app.use(session({
    name: 'VeBongDaSession',
    secret: 'Mèo méo meo mèo meo', 
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // Hết hạn sau 30 ngày
    }
}));

// Middleware xử lý biến cục bộ cho tất cả các file EJS
app.use((req, res, next) => {
    // Chuyển session thành biến locals để dùng trực tiếp trong views
    res.locals.session = req.session;
    
    // Lấy thông báo lỗi hoặc thành công từ session (nếu có)
    var err = req.session.error;
    var msg = req.session.success;
    
    // Xóa session sau khi đã chuyển qua biến trung gian để không hiện lại lần sau
    delete req.session.error;
    delete req.session.success;
    
    // Gán thông báo vào biến locals để hiển thị bằng Bootstrap Alert
    res.locals.message = '';
    if (err) res.locals.message = '<div class="alert alert-danger alert-dismissible fade show" role="alert">' + err + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    if (msg) res.locals.message = '<div class="alert alert-success alert-dismissible fade show" role="alert">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    
    next();
});

// đường dẫn
app.use('/', indexRouter);         
app.use('/auth', authRouter);        
app.use('/admin', adminRouter);       
app.use('/donhang', donhangRouter);   
app.use('/naptien', naptienRouter);
// khởi động
app.listen(3000, () => {
    console.log('🚀 Hệ thống đang chạy tại: http://127.0.0.1:3000');
});