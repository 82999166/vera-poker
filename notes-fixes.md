# Bug Fixes Notes

## 1. Red Packet Create Error: "Cannot read properties of null (reading 'id')"
- Line 3943 in routers.ts: `ctx.user!.id` crashes when logged in as admin_users (ctx.user is null, ctx.adminUser exists)
- Fix: Change to `ctx.adminUser?.adminId ?? ctx.user?.id ?? 0`

## 2. Broadcast Failure (7/7 failed)
- Line 166-168 in marketing.ts: `body.photo = task.imageUrl` sends `/manus-storage/...` path
- TG API can't access internal /manus-storage/ URLs
- Fix: Before sending, resolve /manus-storage/ paths to signed URLs using `storageGetSignedUrl`
- Also need to handle web_app button URLs - if they start with `/`, need to prepend the app domain

## 3. Web_app button URL issue
- TG web_app buttons require FULL https:// URL, not relative paths
- If buttons have type "web_app" and url starts with "/", need to prepend the app's public URL
- App URL can be derived from config or env

## Key patterns from codebase:
- `ctx.adminUser?.adminId ?? ctx.user?.id ?? 0` - safe admin ID extraction
- `storageGetSignedUrl(key)` - converts storage key to public URL
- `resolveAvatarUrl(url)` - already handles /manus-storage/ → signed URL conversion
