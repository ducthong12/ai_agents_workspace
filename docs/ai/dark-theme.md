# Làm mới giao diện và dark theme

Cập nhật: 29/10/2026. Yêu cầu: revamp giao diện Orbit và bổ sung dark theme.

## Hành vi và thiết kế

- Dark theme mặc định: nền graphite, panel nhiều lớp, điểm nhấn xanh lime; biểu đồ và nhãn Claude màu apricot, Codex màu violet.
- Thiết kế lại sidebar, trạng thái điều hướng, header, số liệu tổng quan, biểu đồ, bảng, thư viện tài liệu, màn hình AI, biểu mẫu và hộp thoại.
- Nút sáng/tối trên header có nhãn hỗ trợ trình đọc màn hình. Lựa chọn lưu bằng localStorage; nếu storage không khả dụng, giao diện vẫn hoạt động trong phiên.
- CSS dùng biến màu chung cho cả hai theme; giảm chuyển động khi hệ điều hành yêu cầu. Không thêm dependency hoặc tải font bên ngoài.

## File liên quan

public/style.css; public/index.html; public/app.js.

## Kiểm tra thực tế

- node --check public/app.js đạt; HTTP trang chính và stylesheet trả 200.
- Trình duyệt thực kiểm tra dark mặc định, đổi sang light, tải lại vẫn light, đổi lại dark thành công.
- Desktop 1440px: dashboard và lời mời hiển thị, không tràn ngang.
- Mobile 390px: tài liệu, AI Studio, dự án và lời mời không tràn ngang toàn trang; bảng dài có vùng cuộn riêng.
- Hộp thêm tài liệu mở/đóng, nền và chữ theo dark theme. Không tạo tài liệu thử hoặc chạy model AI trong lần kiểm tra giao diện này.
- Tương phản dark: chữ chính 15.71:1, muted 7.74:1, chữ phụ trên surface raised 5.58:1, nút chính 13.04:1.

## Giới hạn

Kiểm tra trực quan trên trình duyệt hiện có; chưa kiểm tra mọi trình duyệt hoặc toàn bộ nội dung của từng tài liệu dài. Các luồng chạy model không được gọi lại vì thay đổi chỉ nằm ở giao diện và lựa chọn theme.
