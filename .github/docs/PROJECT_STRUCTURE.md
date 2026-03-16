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
│  ├─ app.ts
│  ├─ server.ts
│  ├─ config/
│  │  ├─ env.ts
│  │  ├─ swagger.ts
│  │  └─ logger.ts
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.route.ts
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.repository.ts
│  │  │  └─ auth.validation.ts
│  │  ├─ users/
│  │  │  ├─ user.route.ts
│  │  │  ├─ user.controller.ts
│  │  │  ├─ user.service.ts
│  │  │  ├─ user.repository.ts
│  │  │  └─ user.validation.ts
│  │  ├─ conversations/
│  │  │  ├─ conversation.route.ts
│  │  │  ├─ conversation.controller.ts
│  │  │  ├─ conversation.service.ts
│  │  │  ├─ conversation.repository.ts
│  │  │  └─ conversation.validation.ts
│  │  └─ messages/
│  │     ├─ message.route.ts
│  │     ├─ message.controller.ts
│  │     ├─ message.service.ts
│  │     ├─ message.repository.ts
│  │     └─ message.validation.ts
│  ├─ middlewares/
│  │  ├─ auth.middleware.ts
│  │  ├─ error.middleware.ts
│  │  ├─ notFound.middleware.ts
│  │  └─ rateLimit.middleware.ts
│  ├─ lib/
│  │  ├─ prisma.ts
│  │  ├─ jwt.ts
│  │  └─ bcrypt.ts
│  ├─ types/
│  │  ├─ api-error.ts
│  │  ├─ api-response.ts
│  │  ├─ common.types.ts
│  │  └─ index.ts
│  ├─ sockets/
│  │  ├─ index.ts
│  │  └─ handlers/
│  │     ├─ message.handler.ts
│  │     └─ presence.handler.ts
│  ├─ utils/
│  │  ├─ pagination.ts
│  │  ├─ date.ts
│  │  └─ string.ts
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
- `env.ts`: parse + validate biến môi trường.
- `swagger.ts`: OpenAPI setup.
- `logger.ts`: cấu hình logging.

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

### 3.7 `src/types`
Nơi định nghĩa kiểu dữ liệu dùng chung toàn dự án:
- API contract (`api-error`, `api-response`).
- DTO/type dùng giữa controller-service-repository.
- Common/domain types tái sử dụng.

### 3.8 `src/sockets`
Tập trung xử lý realtime (chat events, presence).

### 3.9 `src/utils`
Chỉ chứa helper functions thuần kỹ thuật (format, parse, transform, date, string),
không chứa type/data contract hoặc business logic.

---

## 4) Luồng xử lý chuẩn
Mỗi request HTTP nên đi theo chuỗi:

`Route -> Validation -> Controller -> Service -> Repository -> Prisma`

Điều này giúp:
- Test dễ hơn.
- Thay đổi DB hoặc business logic ít ảnh hưởng toàn hệ thống.
- Tránh “God file” ở `index.ts`.

---

## 5) Mapping từ trạng thái hiện tại
Hiện tại dự án có:
- `src/index.ts`
- `src/prisma.ts`
- `src/config/swagger.ts`

Khuyến nghị chuyển dần:
1. Tách `src/index.ts` thành:
   - `src/app.ts` (khởi tạo app, middleware, routes)
   - `src/server.ts` (listen cổng)
2. Chuyển `src/prisma.ts` sang `src/lib/prisma.ts`.
3. Giữ `src/config/swagger.ts` và mở rộng theo module route.
4. Tạo từng module nghiệp vụ theo thứ tự: `auth` -> `users` -> `conversations` -> `messages`.
5. Tạo `src/types` để quản lý API error/data type, giữ `src/utils` chỉ cho helper functions.

---

## 6) Quy ước đặt tên
- File: `kebab` hoặc `dot style` nhất quán theo module (khuyến nghị: `auth.service.js`).
- File: `kebab` hoặc `dot style` nhất quán theo module (khuyến nghị: `auth.service.ts`).
- Class/constructor (nếu dùng): `PascalCase`.
- Hàm/biến: `camelCase`.
- Mỗi file chỉ nên có một trách nhiệm chính.

---

## 7) Checklist maintain
- [ ] Mọi endpoint có validation.
- [ ] Không query Prisma trực tiếp trong controller.
- [ ] Mọi lỗi đi qua `error.middleware`.
- [ ] Type/data contract đặt trong `src/types`, không đặt trong `src/utils`.
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

