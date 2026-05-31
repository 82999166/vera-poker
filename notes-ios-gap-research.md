# iOS TG Mini App 顶部空白问题研究

## 问题描述
所有 iPhone 设备（12 Pro, 12, 7 Plus）在 TG Mini App 中打开时顶部有空白。小米正常。

## 根本原因
1. **Telegram iOS WebView 不支持标准 `env(safe-area-inset-*)`** — GitHub issue #1377 确认这是一个已知 bug
2. **Telegram 提供自己的 CSS 变量**：`var(--tg-content-safe-area-inset-top)` 等
3. **expand() 方法在 iOS 上有 bug** — 不能完全展开到顶部（issue #1302）
4. **iOS WebView 的 overscroll 行为**导致页面可以被拖动产生空白

## 解决方案（来自 Stack Overflow 高赞回答）

### 方案 1：viewport + visualViewport 监听（推荐）
```html
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,shrink-to-fit=no,viewport-fit=cover">
```

```js
// 在 main.tsx 入口文件中
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    document.body.style.height = window.visualViewport.height + 'px';
  });
}
// 防止 overscroll
window.addEventListener('scroll', () => {
  if (window.scrollY > 0) window.scrollTo(0, 0);
});
```

```css
html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}
#root {
  overflow-y: auto;
}
```

### 方案 2：使用 Telegram SDK 的 expand() + requestFullscreen()
```js
import { viewport, init, isTMA } from '@telegram-apps/sdk';

useEffect(() => {
  async function initTg() {
    if (await isTMA()) {
      init();
      if (viewport.mount.isAvailable()) {
        await viewport.mount();
        viewport.expand();
      }
      if (viewport.requestFullscreen.isAvailable()) {
        await viewport.requestFullscreen();
      }
    }
  }
  initTg();
}, []);
```

### 方案 3：使用 TG 自带的 CSS 变量
Telegram 提供了自己的 safe area CSS 变量（Bot API 8.0+）：
- `var(--tg-safe-area-inset-top)` — 设备物理安全区域
- `var(--tg-content-safe-area-inset-top)` — 内容安全区域（TG header 下方）

## 推荐实施
结合方案 1 + 方案 3：
1. 修改 viewport meta tag（已完成）
2. 在 main.tsx 添加 visualViewport 监听 + 防 overscroll
3. CSS 中使用 TG 自带的 CSS 变量作为 padding-top
4. 调用 Telegram.WebApp.expand() 确保展开
