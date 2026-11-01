# Docker runtime cho TN Workspace

## Yêu cầu

Build source thành Docker image và chạy web trên máy hiện tại, sử dụng lại tài khoản local đã cấu hình.

## Thay đổi và lý do

- `Dockerfile`: Node 24 trên Debian slim, Git và CA certificates; chạy dưới user `node`, có healthcheck HTTP và lệnh khởi động trực tiếp. Không cần cài thư viện npm vì dự án dùng các module Node có sẵn.
- `.dockerignore`: chỉ cho package metadata, module runtime và public assets vào build context. Dữ liệu local, credential, profile, Git và test không được đóng gói vào image.
- `compose.yaml`: image `ai-workspace:local`, service `web`, publish cổng `127.0.0.1:4317`, init process, restart policy và giới hạn log. Bind mount `./data` giữ tài khoản/trạng thái ngoài vòng đời container. Thư mục cha source được mount chỉ đọc tại `/workspace`; bản gom tài liệu nằm trong `/app/data/brand-docs`.
- `server.mjs`: thêm `TN_BIND_HOST`; mặc định Node trực tiếp vẫn nghe trên loopback, image/Compose chọn `0.0.0.0` trong container để port mapping truy cập được. Kiểm tra Host, Origin và đăng nhập giữ nguyên.
- `test/workspace.test.mjs`: mock cho phép chặn riêng lần dispatch Retry. Test đợi cổng đồng bộ thay vì phụ thuộc thời gian xử lý nền, đồng thời xác nhận Retry đang chạy không tạo thêm lần dispatch. Không thay đổi nghiệp vụ Retry.
- `SETUP.md`, `README.md`: hướng dẫn build/chạy/dừng, tạo tài khoản, lưu dữ liệu và các giới hạn Linux/Windows.
- Bổ sung nguồn lịch sử: `configure-docker-host.mjs` tạo override riêng cho máy để mount các thư mục session chỉ đọc. `compose.yaml` bật danh mục log và chế độ Studio chỉ xem. Chi tiết giao diện/nguồn tại `desktop-studio-layout.md`; override không chứa credential và không được đưa vào Git/image.

## Kiểm tra đã chạy

- `docker compose config --quiet`: đạt.
- `docker compose build`: build thành công image `ai-workspace:local`.
- `docker compose up -d --wait --wait-timeout 90`: container `ai-workspace-web-1` healthy.
- HTTP từ Windows tới cổng Docker: trang chính khi chưa đăng nhập trả 302; API riêng tư trả 401; Origin ngoài trả 403; đăng nhập bằng tài khoản hiện có và đọc trang chính sau đăng nhập đều trả 200.
- `docker compose restart web`, sau đó chờ healthy và đăng nhập lại: đạt HTTP 200 với tài khoản hiện có, xác nhận auth còn được giữ sau restart.
- Chạy image độc lập, không mount dữ liệu: UID bằng 1000, không tồn tại auth local, `.git`, `.env` hoặc `.claude` trong `/app`.
- Bộ 80 test trên Windows với Node 24: đạt toàn bộ.
- Bộ 80 test trên image Linux, chỉ mount thư mục test ở chế độ chỉ đọc và tắt mạng: đạt toàn bộ. Lần chạy Linux đầu phát hiện một assertion thời điểm trong test Retry; đã sửa đồng bộ của mock và chạy lại cả hai môi trường thành công.
- `git diff --check`: đạt trước khi hoàn tất.

## Giới hạn

- Image chưa có Claude/Codex CLI hoặc MCP profile. Các thư mục lịch sử Windows có thể nối bằng override chỉ đọc; Linux không gọi được `explorer.exe` để mở Desktop. Chưa triển khai cầu nối điều khiển Desktop/MCP từ container sang Windows.
- Đường dẫn repo phải là đường dẫn Linux dưới `/workspace`; các đường dẫn Windows đã lưu không được tự chuyển đổi.
- Workspace mount chỉ đọc, nên không dùng container mặc định để sửa code hoặc cài instruction vào repo. Dữ liệu ứng dụng vẫn được ghi trong bind mount `data`.
- Không chạy Node local và container đồng thời với cùng `data`. Đã dừng process Node do phiên này khởi tạo trước khi chuyển sang container.
- Không push image lên registry và không triển khai lên máy chủ từ xa.

Tham khảo: [Docker Compose services](https://docs.docker.com/reference/compose-file/services/) và [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).
