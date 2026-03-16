# Chatter Project Documentation

## 1) Mục tiêu tài liệu
Tài liệu này mô tả cấu trúc thư mục chuẩn cho dự án Chatter (Express + Prisma + Swagger), theo định hướng:
- Dễ mở rộng theo tính năng.
- Dễ bảo trì khi team lớn dần.
- Tách rõ vai trò giữa route, business logic, data access.

> Quy ước mới: **tất cả tài liệu dự án được lưu trong thư mục `.github/docs`**.

---

## 2) Cấu trúc thư mục đề xuất

```txt
.
├─ .github/
│  └─ docs/
│     ├─ PROJECT_STRUCTURE.md
│     ├─ API_GUIDELINES.md
│     ├─ DATABASE.md
│     └─ DEPLOYMENT.md
├─ prisma/
│  ├─ schema.prisma
│  ├─ chatter_schema.sql
│  └─ migrations/
├─ src/
│  ├─ app.js
│  ├─ server.js
│  ├─ config/
│  │  ├─ env.js
│  │  ├─ swagger.js
│  │  └─ logger.js
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.route.js
│  │  │  ├─ auth.controller.js
│  │  │  ├─ auth.service.js
│  │  │  ├─ auth.repository.js
│  │  │  └─ auth.validation.js
│  │  ├─ users/
│  │  │  ├─ user.route.js
│  │  │  ├─ user.controller.js
│  │  │  ├─ user.service.js
│  │  │  ├─ user.repository.js
│  │  │  └─ user.validation.js
│  │  ├─ conversations/
│  │  │  ├─ conversation.route.js
│  │  │  ├─ conversation.controller.js
│  │  │  ├─ conversation.service.js
│  │  │  ├─ conversation.repository.js
│  │  │  └─ conversation.validation.js
│  │  └─ messages/
│  │     ├─ message.route.js
│  │     ├─ message.controller.js
│  │     ├─ message.service.js
│  │     ├─ message.repository.js
│  │     └─ message.validation.js
│  ├─ middlewares/
│  │  ├─ auth.middleware.js
│  │  ├─ error.middleware.js
│  │  ├─ notFound.middleware.js
│  │  └─ rateLimit.middleware.js
│  ├─ lib/
│  │  ├─ prisma.js
│  │  ├─ jwt.js
│  │  └─ bcrypt.js
│  ├─ sockets/
│  │  ├─ index.js
│  │  └─ handlers/
│  │     ├─ message.handler.js
│  │     └─ presence.handler.js
│  ├─ utils/
│  │  ├─ ApiError.js
│  │  ├─ ApiResponse.js
│  │  └─ pagination.js
│  └─ tests/
│     ├─ unit/
│     └─ integration/
├─ package.json
└─ prisma.config.ts
```

---

## 3) Ý nghĩa từng khu vực

### 3.1 `.github/docs`
Khu vực chứa toàn bộ tài liệu nội bộ dự án:
- Kiến trúc hệ thống.
- Chuẩn API.
- Quy ước code style.
- Hướng dẫn deploy / vận hành.

### 3.2 `prisma`
- `schema.prisma`: schema cho Prisma Client.
- `chatter_schema.sql`: SQL chuẩn PostgreSQL.
- `migrations`: lịch sử migration để deploy nhất quán.

### 3.3 `src/config`
Chứa cấu hình theo môi trường:
- `env.js`: parse + validate biến môi trường.
- `swagger.js`: OpenAPI setup.
- `logger.js`: cấu hình logging.

### 3.4 `src/modules/*`
Tổ chức theo domain nghiệp vụ (feature-first):
- `*.route.js`: định nghĩa endpoint.
- `*.controller.js`: nhận request/response.
- `*.service.js`: business logic.
- `*.repository.js`: truy cập DB qua Prisma.
- `*.validation.js`: validate input (Zod).

### 3.5 `src/middlewares`
Middleware dùng chung: xác thực, xử lý lỗi, rate limit, not found.

### 3.6 `src/lib`
Adapter cho thư viện bên ngoài (`prisma`, `jwt`, `bcrypt`) để tránh logic rải rác.

### 3.7 `src/sockets`
Tập trung xử lý realtime (chat events, presence).

### 3.8 `src/utils`
Helper thuần kỹ thuật, không chứa business logic.

---

## 4) Luồng xử lý chuẩn
Mỗi request HTTP nên đi theo chuỗi:

`Route -> Validation -> Controller -> Service -> Repository -> Prisma`

Điều này giúp:
- Test dễ hơn.
- Thay đổi DB hoặc business logic ít ảnh hưởng toàn hệ thống.
- Tránh “God file” ở `index.js`.

---

## 5) Mapping từ trạng thái hiện tại
Hiện tại dự án có:
- `src/index.js`
- `src/prisma.js`
- `src/config/swagger.js`

Khuyến nghị chuyển dần:
1. Tách `src/index.js` thành:
   - `src/app.js` (khởi tạo app, middleware, routes)
   - `src/server.js` (listen cổng)
2. Chuyển `src/prisma.js` sang `src/lib/prisma.js`.
3. Giữ `src/config/swagger.js` và mở rộng theo module route.
4. Tạo từng module nghiệp vụ theo thứ tự: `auth` -> `users` -> `conversations` -> `messages`.

---

## 6) Quy ước đặt tên
- File: `kebab` hoặc `dot style` nhất quán theo module (khuyến nghị: `auth.service.js`).
- Class/constructor (nếu dùng): `PascalCase`.
- Hàm/biến: `camelCase`.
- Mỗi file chỉ nên có một trách nhiệm chính.

---

## 7) Checklist maintain
- [ ] Mọi endpoint có validation.
- [ ] Không query Prisma trực tiếp trong controller.
- [ ] Mọi lỗi đi qua `error.middleware`.
- [ ] Có test integration cho luồng quan trọng.
- [ ] Swagger luôn cập nhật cùng endpoint mới.
- [ ] Tài liệu mới luôn đặt trong `.github/docs`.

---

## 8) Danh sách tài liệu nên có tiếp theo
Tạo thêm trong `.github/docs`:
- `API_GUIDELINES.md`: chuẩn request/response/error.
- `DATABASE.md`: ERD + indexing strategy + migration policy.
- `AUTH_FLOW.md`: JWT refresh token, session, revoke.
- `DEPLOYMENT.md`: môi trường, biến env, CI/CD.

