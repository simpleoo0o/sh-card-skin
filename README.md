# Card Skin Studio

一个完全在浏览器本地运行的卡面编辑器：自由裁切照片、叠加可变换 Logo，并导出可交给 AirCard 使用的图片。

在线使用：<https://simpleoo0o.github.io/sh-card-skin/>

## 功能

- 上传 JPG、PNG 或 WebP 照片，拖动、缩放和任意角度旋转取景。
- 自动约束照片，旋转或移动后仍完整覆盖卡面。
- 内置从上海交通卡 App 安装包提取的透明完整标识，以及两款可放大的图形标识 SVG。
- 支持上传 PNG、JPG、WebP 或经过安全检查的 SVG 自定义 Logo。
- Logo 可拖动、缩放和旋转，也可部分移出卡面。
- 导出精确的 **1536 × 969** 完整矩形 PNG，不包含预览圆角或编辑选框。
- 自动适配浅色、深色与“减少动态效果”系统设置。

## 使用方法

1. 点击“选择照片”，或将照片拖到上传区域。
2. 选择“照片”图层，在卡面上拖拽取景、滚轮缩放；拖动旋转手柄可自由调整角度。
3. 选择完整标识、图形标识或经典图形预设，也可上传自己的 Logo。
4. 选择“Logo”图层，以相同方式调整位置、大小和角度；“左转”“右转”可快速旋转 90°。
5. 可使用方向键移动当前图层；按住 Shift 时每次移动 10 像素。
6. 点击“导出 PNG”，再将下载的图片用于 AirCard 卡面设置。

## 隐私

照片和自定义 Logo 只保存在当前页面的浏览器内存中。本项目没有后端，不会上传素材，也不会写入 localStorage、IndexedDB 或 Cookie；刷新或关闭页面即清除当前作品。

内置 Logo 和应用代码会作为 GitHub Pages 的静态资源正常加载。

## 本地开发

需要 Node.js 22.12.0 或更高版本，推荐 Node.js 24。

```bash
npm install
npm run dev
npm run check
npm run test:e2e
```

`npm run check` 会运行单元测试、TypeScript 检查和生产构建。首次运行浏览器测试前，可执行 `npx playwright install chromium webkit` 安装测试浏览器。

## 部署

推送到 `main` 后，GitHub Actions 会执行锁定依赖安装、测试和构建，并把 `dist` 自动发布到 GitHub Pages。Vite 的部署子路径固定为 `/sh-card-skin/`。

## 项目与素材声明

本项目为独立的个人工具，与 [AirCard](https://github.com/Mak5er/AirCard)、上海公共交通卡股份有限公司均无关联，也不能直接替代 AirCard 写入卡面。

上海公共交通卡名称与标识属于其权利人。内置素材的来源与限制见 [`public/logos/SOURCES.md`](public/logos/SOURCES.md)。
