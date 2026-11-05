
        // =====================================================
        //  QUẢN TRỊ: TÍCH HỌC SINH ĐÃ ĐÓNG TIỀN KHÓA HỌC
        // =====================================================

        // ----- Phân quyền theo từng gói đề: mỗi học sinh có danh sách gói được vào (tk.mucLuyen) -----
        function cacGoiPhanQuyen() { return GOI.filter(function (g) { return !g.mf; }); }   // gói Miễn phí luôn mở, không cần tích
        function layGoiHS(u) {
            if (Array.isArray(u.mucLuyen)) { return u.mucLuyen; }
            return u.daMuaKhoa === true ? cacGoiPhanQuyen().map(function (g) { return g.id; }) : [];   // tài khoản cũ đã tích: được vào tất cả gói
        }
        function goiDuocPhep(email, idGoi) {
            const g = GOI.find(function (x) { return x.id === idGoi; });
            if (!g || g.mf) { return true; }
            if (!email) { return false; }
            const kho = docKho('localStorage', KHO_TK);
            if (Array.isArray(kho)) { danhSach = kho; }
            const tk = timTaiKhoan(email);
            if (!tk) { return false; }
            if (tk.vaiTro === 'admin') { return true; }
            if (Array.isArray(tk.maDaNhap) && tk.maDaNhap.some(maHopLe)) { return true; }   // nhập mã truy cập: được vào tất cả gói
            return layGoiHS(tk).indexOf(idGoi) !== -1;
        }

        (function themTabKhoaHoc() {
            const tabs = document.querySelector('.ad-tabs');
            const trang = document.querySelector('.admin-page');
            if (!tabs || !trang) { return; }

            const nut = document.createElement('button');
            nut.className = 'ad-tab';
            nut.dataset.ad = 'tk';
            nut.textContent = '🎓 Học sinh trong khóa';
            tabs.insertBefore(nut, tabs.querySelector('button[data-ad="dl"]'));

            const khung = document.createElement('div');
            khung.className = 'ad-pane';
            khung.id = 'ad-tk';
            khung.innerHTML =
                '<div class="toolbar">' +
                '<input class="grow" id="tk-tim" placeholder="🔍 Tìm học sinh theo tên, email, lớp">' +
                '<span class="tbl-foot" id="tk-dem"></span></div>' +
                '<p class="tbl-foot">Tích từng gói để cho học sinh vào luyện gói đó (Chuyên đề, Cẩm nang, Thực chiến…). Ô "Tất cả" tích hoặc bỏ tất cả các gói. Gói Miễn phí luôn mở cho mọi học sinh. Học sinh chưa tích gói nào chỉ đăng ký và làm khảo thí thi thử.</p>' +
                '<div class="table-wrap"><table class="tbl"><thead><tr>' +
                '<th style="width:70px">Tất cả</th><th>Họ và tên</th><th>Email</th><th>Lớp</th>' +
                cacGoiPhanQuyen().map(function (g) { return '<th style="text-align:center">' + thoat(g.ten.replace('Phòng Luyện ', '')) + '</th>'; }).join('') +
                '<th>Trạng thái</th>' +
                '</tr></thead><tbody id="tk-body"></tbody></table></div>';
            trang.appendChild(khung);

            nut.addEventListener('click', function () {
                document.querySelectorAll('.ad-tab').forEach(function (n) { n.classList.remove('active'); });
                document.querySelectorAll('.ad-pane').forEach(function (p) { p.classList.remove('active'); });
                nut.classList.add('active');
                khung.classList.add('active');
                veTichKhoa();
            });

            document.getElementById('tk-tim').addEventListener('input', veTichKhoa);

            document.getElementById('tk-body').addEventListener('change', function (e) {
                const o = e.target;
                if (!o.matches('input[type=checkbox][data-email]')) { return; }
                const tk = timTaiKhoan(o.dataset.email);
                if (!tk) { return; }
                const idGoi = o.dataset.goi || 'all';
                let ds = layGoiHS(tk).slice();
                let thongBao;
                if (idGoi === 'all') {
                    ds = o.checked ? cacGoiPhanQuyen().map(function (g) { return g.id; }) : [];
                    thongBao = o.checked ? 'Đã cấp tất cả gói đề cho ' + tk.ten : 'Đã thu quyền phòng luyện của ' + tk.ten;
                } else {
                    const i = ds.indexOf(idGoi);
                    if (o.checked && i === -1) { ds.push(idGoi); }
                    if (!o.checked && i !== -1) { ds.splice(i, 1); }
                    const goi = GOI.find(function (x) { return x.id === idGoi; });
                    thongBao = (o.checked ? 'Đã cấp "' : 'Đã thu "') + (goi ? goi.ten : idGoi) + '" của ' + tk.ten;
                }
                tk.mucLuyen = ds;
                tk.daMuaKhoa = ds.length > 0;   // giữ tương thích với duocLuyenDe()
                luuTaiKhoan();
                veTichKhoa();
                hienToast(thongBao);
            });
        })();

        function veTichKhoa() {
            const bang = document.getElementById('tk-body');
            if (!bang) { return; }
            const k = (document.getElementById('tk-tim').value || '').trim().toLowerCase();
            const hs = danhSach.filter(function (u) {
                if (u.vaiTro !== 'hocsinh') { return false; }
                if (k === '') { return true; }
                return (u.ten + ' ' + u.email + ' ' + (u.lop || '')).toLowerCase().indexOf(k) !== -1;
            });
            const soTich = danhSach.filter(function (u) { return u.vaiTro === 'hocsinh' && layGoiHS(u).length > 0; }).length;
            document.getElementById('tk-dem').textContent = 'Đã tích: ' + soTich + ' / ' + danhSach.filter(function (u) { return u.vaiTro === 'hocsinh'; }).length + ' học sinh';

            if (hs.length === 0) {
                bang.innerHTML = '<tr><td colspan="' + (5 + cacGoiPhanQuyen().length) + '" class="empty-row">Không có học sinh phù hợp.</td></tr>';
                return;
            }
            const cacGoi = cacGoiPhanQuyen();
            bang.innerHTML = hs.map(function (u) {
                const ds = layGoiHS(u);
                const tich = ds.length > 0;
                const duTatCa = cacGoi.length > 0 && cacGoi.every(function (g) { return ds.indexOf(g.id) !== -1; });
                const cot = cacGoi.map(function (g) {
                    return '<td style="text-align:center"><input type="checkbox" data-email="' + thoat(u.email) + '" data-goi="' + g.id + '"' + (ds.indexOf(g.id) !== -1 ? ' checked' : '') + ' style="width:18px;height:18px;cursor:pointer"></td>';
                }).join('');
                return '<tr><td style="text-align:center"><input type="checkbox" data-email="' + thoat(u.email) + '" data-goi="all"' + (duTatCa ? ' checked' : '') + ' style="width:18px;height:18px;cursor:pointer"></td>' +
                       '<td><b>' + thoat(u.ten) + '</b></td><td>' + thoat(u.email) + '</td><td>' + thoat(u.lop || '-') + '</td>' + cot +
                       '<td>' + (tich ? '<span class="tag tag-green">Được vào ' + ds.length + '/' + cacGoi.length + ' gói</span>' : '<span class="tag tag-gray">Chưa cấp quyền</span>') + '</td></tr>';
            }).join('');
        }
    