
        // =====================================================
        //  SAO LƯU SONG SONG LÊN NETLIFY DATABASE
        //  Mọi dữ liệu (tài khoản, bài viết, đề thi, kết quả, đợt/ca thi, đăng ký ca,
        //  mã truy cập, kho câu hỏi) được ghi thêm một bản lên /api/sao-luu, song song
        //  với máy chủ cũ và Firebase. Bản mới ghi đè bản hiện hành, bản cũ được giữ lại trong lịch sử.
        // =====================================================
        (function () {
            const API_SAO_LUU = '/api/sao-luu';
            const KHOA_ANH_SL = 'skyedu-anh-sao-luu';
            const BO_SAO_LUU = [
                { loai: 'tai-khoan',   kho: KHO_TK,  mang: () => danhSach,  ma: x => x.email },
                { loai: 'bai-viet',    kho: KHO_BV,  mang: () => baiViet,   ma: x => x.id },
                { loai: 'de',          kho: KHO_DE,  mang: () => deThi,     ma: x => x.id },
                { loai: 'kq',          kho: KHO_KQ,  mang: () => ketQua,    ma: x => x.id },
                { loai: 'dot',         kho: KHO_CA,  mang: () => dotThi,    ma: x => x.id },
                { loai: 'ca',          kho: KHO_CA,  mang: () => caThi,     ma: x => x.id },
                { loai: 'dk',          kho: KHO_CA,  mang: () => dangKyCa,  ma: x => x.id || (x.caId + '|' + x.email) },
                { loai: 'ma',          kho: KHO_MA,  mang: () => maTruyCap, ma: x => x.ma },
                { loai: 'kho-cau-hoi', kho: KHO_KHO, mang: () => khoCH,     ma: x => x.id }
            ];
            const GIOI_HAN_GOI = 3 * 1024 * 1024;   // mỗi lần gửi tối đa ~3 MB
            const TOI_DA_MUC = 150;

            // Ảnh chụp dạng mã băm (nhẹ, không làm đầy bộ nhớ trình duyệt): "loai|ma" -> băm
            let anh = (function () {
                try { return JSON.parse(localStorage.getItem(KHOA_ANH_SL) || '{}') || {}; } catch (e) { return {}; }
            })();
            function luuAnh() { try { localStorage.setItem(KHOA_ANH_SL, JSON.stringify(anh)); } catch (e) {} }
            function bam(t) {
                let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
                for (let i = 0; i < t.length; i++) {
                    const c = t.charCodeAt(i);
                    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
                }
                h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
                h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
                return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
            }

            let dangGui = false, guiLai = false, hen = null;

            async function saoLuu() {
                if (dangGui) { guiLai = true; return; }
                dangGui = true;
                try {
                    const thayDoi = [];   // { muc, khoa, bam }
                    BO_SAO_LUU.forEach(function (bo) {
                        let mang;
                        try { mang = bo.mang(); } catch (e) { return; }
                        if (!Array.isArray(mang)) { return; }
                        const coMat = new Set();
                        mang.forEach(function (x) {
                            if (!x) { return; }
                            const ma = bo.ma(x);
                            if (ma === undefined || ma === null || ma === '') { return; }
                            const khoa = bo.loai + '|' + ma;
                            coMat.add(khoa);
                            const j = JSON.stringify(x), b = bam(j);
                            if (anh[khoa] !== b) { thayDoi.push({ muc: { loai: bo.loai, ma: String(ma), duLieu: x }, khoa: khoa, bam: b, co: j.length }); }
                        });
                        Object.keys(anh).forEach(function (khoa) {
                            if (khoa.indexOf(bo.loai + '|') === 0 && !coMat.has(khoa)) {
                                thayDoi.push({ muc: { loai: bo.loai, ma: khoa.slice(bo.loai.length + 1), xoa: true }, khoa: khoa, bam: null, co: 50 });
                            }
                        });
                    });
                    // Chia thành nhiều lần gửi vừa sức
                    let goi = [], co = 0;
                    const cacGoi = [];
                    thayDoi.forEach(function (t) {
                        if (goi.length && (goi.length >= TOI_DA_MUC || co + t.co > GIOI_HAN_GOI)) { cacGoi.push(goi); goi = []; co = 0; }
                        goi.push(t); co += t.co;
                    });
                    if (goi.length) { cacGoi.push(goi); }
                    for (const g of cacGoi) {
                        const r = await fetch(API_SAO_LUU, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ muc: g.map(function (t) { return t.muc; }) })
                        });
                        if (!r.ok) { break; }   // lỗi: lần sau gửi lại
                        g.forEach(function (t) { if (t.bam) { anh[t.khoa] = t.bam; } else { delete anh[t.khoa]; } });
                        luuAnh();
                    }
                } catch (e) { /* mất mạng: lần sau gửi lại */ }
                finally {
                    dangGui = false;
                    if (guiLai) { guiLai = false; henSaoLuu(); }
                }
            }
            function henSaoLuu() { clearTimeout(hen); hen = setTimeout(saoLuu, 800); }

            // Mỗi lần lưu trên máy này thì ghi song song lên Netlify Database
            const CAC_KHO = new Set(BO_SAO_LUU.map(function (b) { return b.kho; }));
            const ghiKhoTruocSaoLuu = ghiKho;
            ghiKho = function (loai, khoa, gia) {
                ghiKhoTruocSaoLuu(loai, khoa, gia);
                if (CAC_KHO.has(khoa)) { henSaoLuu(); }
            };

            // Lần đầu mở trang: sao lưu toàn bộ dữ liệu cũ đang có (sau khi đã nhận dữ liệu từ máy chủ cũ),
            // sau đó kiểm tra định kỳ để bắt cả các thay đổi đến từ Firebase / máy chủ cũ
            window.addEventListener('load', function () { setTimeout(saoLuu, 5000); });
            setInterval(saoLuu, 30000);
        })();
    