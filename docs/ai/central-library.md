# Kho tài liệu AI chung

Ngày cập nhật: 29/10/2026.

## Thay đổi

Đã gom tài liệu từ G:/Work/docs/AI, G:/Work/adtimabox-cshub và G:/Work/2026-cshub-miniapp-base-v3 vào G:/Work/docs/AI-Hub. Giữ nguyên nguồn, mirror cấu trúc và kiểm chứng SHA-256. Tổng 529 file nhập, gồm 375 Markdown và tài nguyên kèm theo.

Tài liệu mới ghi trong AI-Hub/docs/projects/<repo>/features/<feature>/. Tài liệu versioned tiếp tục sửa ở repo nguồn rồi chạy tools/sync-library.mjs để refresh bản tham chiếu. Cập nhật AGENTS.md, CLAUDE.md của hai repo và .claude/CLAUDE.md của base v3; giữ bản cũ trong AI-Hub/backups/2026-10-29-instructions/.

Website hỗ trợ loại nguồn kho tài liệu (chỉ đọc/lập chỉ mục) và dự án code. Thêm documentationRoot cho từng dự án, chuyển đường dẫn đó vào prompt và --add-dir khi chạy chế độ sửa code để hai CLI ghi được ngoài checkout. Chế độ đọc không được mở thêm vùng ghi. Nâng độ sâu quét Markdown để đọc được API reference lồng nhiều cấp; loại trùng cùng đường dẫn thật khi hai nguồn trỏ cùng file.

## Kiểm tra

- 7 bài node --test đạt, gồm quyền cho thư mục tài liệu ngoài repo và quét tài liệu nhiều cấp.
- Kiểm tra SHA-256 nguồn và đích của 529 file đều khớp manifest.
- Prettier check đạt cho 5 instruction đã tạo/sửa; git diff --check đạt trong scope instruction.
- API thực xác nhận kho AI-Hub và hai dự án đã kết nối, không có lỗi đồng bộ. Trình duyệt thực hiển thị tài liệu đã nhập và thư viện có tìm kiếm.

## Giới hạn

Website tự quét thay đổi trong hub mỗi 30 giây, không tự chạy helper copy tài liệu nguồn. AI được hướng dẫn chạy helper sau khi sửa tài liệu versioned. Chưa gọi AI sửa source sản phẩm để kiểm chứng việc tuân thủ hướng dẫn; không tiêu thụ thêm tác vụ AI chỉ để test đường dẫn. Không xác minh nội dung mọi tài liệu cũ còn đúng với code hiện tại. Nguồn/bản trùng nội dung được giữ theo đường dẫn, không tự xóa.
