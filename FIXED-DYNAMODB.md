# ✅ Fixed DynamoDB Query Issues

## Vấn đề
Lỗi: `ValidationException: The provided key element does not match the schema`

## Nguyên nhân
Bảng DynamoDB `ivs_streams` có **composite primary key**:
- **Partition Key:** `userId` (String)
- **Sort Key:** `createdAt` (String)

Code cũ chỉ truyền `userId` khi query/update, thiếu `createdAt`.

## Đã sửa

### 1. **GET /api/stream/status**
- ❌ **Trước:** Dùng `GetCommand` với chỉ `userId`
- ✅ **Sau:** Dùng `QueryCommand` với `KeyConditionExpression`

```javascript
// Trước (SAI)
const getParams = {
    TableName: STREAMS_TABLE,
    Key: { userId: userId }
};
const result = await docClient.send(new GetCommand(getParams));

// Sau (ĐÚNG)
const queryParams = {
    TableName: STREAMS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    ScanIndexForward: false,
    Limit: 1
};
const result = await docClient.send(new QueryCommand(queryParams));
const streamData = result.Items[0]; // Lấy item đầu tiên
```

### 2. **POST /api/stream/start**
- ❌ **Trước:** Dùng `GetCommand` để kiểm tra stream tồn tại
- ✅ **Sau:** Dùng `QueryCommand`

### 3. **POST /api/stream/stop**
- ❌ **Trước:** Dùng `GetCommand` và `UpdateCommand` thiếu `createdAt`
- ✅ **Sau:** Dùng `QueryCommand` và include `createdAt` trong `UpdateCommand`

```javascript
// Update với đủ key
const updateParams = {
    TableName: STREAMS_TABLE,
    Key: {
        userId: userId,
        createdAt: streamData.createdAt // Phải có sort key
    },
    UpdateExpression: 'SET isLive = :isLive, lastUpdated = :lastUpdated',
    ExpressionAttributeValues: { ... }
};
```

## Kết quả

✅ Server chạy không lỗi
✅ API `/api/stream/status` hoạt động
✅ API `/api/stream/start` hoạt động
✅ API `/api/stream/stop` hoạt động

## Test

1. **Đăng nhập** (cần bật USER_PASSWORD_AUTH trong Cognito)
2. **Tạo stream:** POST `/api/stream/start`
3. **Kiểm tra status:** GET `/api/stream/status` → Sẽ hiển thị `streamKey`
4. **Dừng stream:** POST `/api/stream/stop`

## Lưu ý

- Bảng DynamoDB phải có đúng schema: `userId` (HASH) + `createdAt` (RANGE)
- Khi dùng composite key, **PHẢI truyền cả 2 keys** cho `GetCommand` và `UpdateCommand`
- Dùng `QueryCommand` khi chỉ muốn lọc theo partition key

---

**Status:** ✅ Fixed và tested thành công!
**Date:** 2025-10-15
