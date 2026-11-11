# 交接文档 / HANDOFF

> 给接手的开发者或 AI：读完这一页就能继续改，不用重新摸索。
> 最后更新：2026-11-11，完成四种雪花形态、按型绽放与持续飘雪之后。

## 一、这是什么

**多多花园** —— 以花库为根页面的手势花园 PWA，当前收录「白山茶」与「雪花」两朵花：

- 握拳 → 花束收拢待放；张开手掌 → 两朵主花一层层散开
- 炭黑包装纸、细枝小白花、金色卡片与黑色缎带组成完整花束
- 花朵跟随手的位移，指尖靠近会拨开花瓣
- 雪花先以羽状、板晶、叶瓣、密晶四种小雪片飘落；手部接住哪一型，绽放主体就切换成哪一型
- 捕捉后其余未抓住的雪花继续飘落，只有被抓中的那一片淡出并转成大型晶花
- 雪花捕捉阶段保留实时手部小窗，捕捉成功后继续用同一张手掌控制晶花
- 右下角有实时「手部捕捉」小窗（镜像画面 + 21 点骨架 + 张开度）
- 根页面是花库；两朵花各用独立体验页，可随时返回花库
- 云朵吉祥物多多是固定品牌角色，耳边别着白山茶；图标与首页共用这一造型

| 项目 | 地址 |
|---|---|
| 在线演示（HTTPS，摄像头可用） | https://zyr123-star.github.io/duoduo-garden/ |
| 源码 | https://github.com/zyr123-star/duoduo-garden |
| 技术栈 | 原生 ES Module + Three.js r169（本地）+ MediaPipe Hands（本地）+ GLSL，无构建 |

## 二、当前状态

**能跑、自检全绿**：

```bash
node tools/check.mjs     # 64 项通过，0 失败
node tools/server.cjs    # → http://127.0.0.1:4182
```

**2026-11-11 浏览器验收结果**：

- Edge 无头浏览器使用 SwiftShader 建起 WebGL 2；白山茶与雪花着色器均编译通过，WebGL 错误为 0
- 雪花完成“飘雪搜索 → 指针捕捉 → 按掌盛开 → 重置”全链路验收
- 逐一验收四种雪花几何；抓中板晶后确认其余 19 片继续下落，绽放主体仍为板晶
- Three.js 与 MediaPipe 从本地 `vendor/` 加载；假摄像头成功进入雪花实时模式并初始化手部模型
- 花库 1440×900、390×844，雪花桌面与移动端均无横向溢出
- 尚未验证：真人摄像头下的捕捉半径、真实手机设备、长时间运行稳定性

离线软件渲染器（`tools/preview.mjs`）仍用于单朵粒子花的造型与曝光回归；
花束包装、雪花晶枝、双花构图和卡片布局由真实浏览器截图验证。

## 三、代码地图

```
index.html            花库首页：双花条目、两朵花入口与关于弹窗
camellia.html         白山茶体验页：开场页 / HUD / 手部小窗 / 帮助
snowflake.html        雪花体验页：飘雪搜索 / 手部捕捉 / 晶花控制
garden.css            花库视觉与响应式布局
styles.css            白山茶体验界面（墨绿夜色 / 玉白 / 一点金）
snowflake.css         雪花体验界面（墨青冬夜 / 冰白 / 暖金晶心）
manifest.webmanifest  PWA 名称、图标与两朵花快捷入口
sw.js                 核心页面与资源离线缓存
start-duoduo-garden.cmd  打开正式网址
更新日志.md
assets/               SVG / 180 / 192 / 512 PNG / ICO 图标
vendor/               Three.js 与 MediaPipe Hands 的本地运行时资源
src/
  pwa.js              Service Worker 注册与版本更新
  main.js             主控：状态机、tension→spread、跟随、HUD、错误降级、键盘/指针
  bouquet.js          程序绘制包装纸、粒子花枝、细枝小花、卡片与缎带
  flowerGeometry.js   ★ 纯数学，不依赖 three：花瓣曲面、双姿态、法向、颜色
  flower.js           three.js 层：Points + ShaderMaterial + 光晕 Sprite + 浮尘
  handTracker.js      MediaPipe 封装 + tension 公式 + 模型预热探测
  backdrop.js         背景：全屏墨绿渐变（WebGL）
  handPreview.js      右下角手部捕捉小窗（2D canvas）
  skeleton.js         骨架绘制（小窗用）
  snowflakeExperience.js  ★ 飘雪搜索、捕捉、盛开与重置状态机
  snowfall.js          小雪花群、漂移、吸附与捕捉
  snowflakeGeometry.js  ★ 纯数学，不依赖 three：六向晶枝、双姿态、法向、霜尘
  snowflake.js          three.js 层：晶花 Points + 光晕 + 霜尘
  snowflakeBackdrop.js  墨青冬夜背景
tools/
  server.cjs          本地静态服务（端口 4182）
  check.mjs           61 项自检（两朵花 / 四种雪花 / tension / 着色器 / PWA）
  preview.mjs         离线软件光栅器：不装浏览器也能把粒子渲成 PNG
  sweep.mjs           参数扫描，出 2×2 对比拼图
```

数据流：

```
摄像头帧 → MediaPipe(21点) → tension(0~1) → smoothstep(0.32,0.66) → targetSpread
        → spread 缓动 → 顶点着色器 mix(aBud, aBloom, spread) → 加色粒子

雪花：手部位置 → 吸附小雪花 → 距离阈值内捕捉
      → 张掌 tension → 六向晶枝 bloom 混合 + 暖金晶心 → 盛开
```

**设计上的关键决定**（改之前先读，避免踩回去）：

1. **花瓣只存两套静态顶点**（花苞 / 盛放），中间态全部在顶点着色器里 `mix`。
   CPU 每帧只更新 3 个 uniform。不要改成 CPU 每帧算位置。
2. **画布必须不透明**。透明画布会被浏览器按 premultiplied alpha 合成，加色粒子会出现黑边。
   所以背景是一层 WebGL 全屏渐变（`backdrop.js`），不是 CSS。
3. **大画面不显示摄像头**。白花需要干净深背景；手只看右下角小窗。
   因此跟随不需要像素级对齐，只把手的归一化位置映射成画面中的有限位移（±30% / ±24%）。
4. **用 legacy `@mediapipe/hands` 而不是 tasks-vision**：前者 wasm + 模型都在同一个 npm 包里，
   可以整包镜像到 `vendor/`；后者还要从 storage.googleapis.com 拉模型。
5. **错误必须降级不白屏**：模型加载失败 → 演示模式（呼吸 + 按住模拟张开）。
6. **花束有明确渲染层级**：后层包装纸 0 → 粒子花枝 1 → 粒子花 2 →
   前层包装纸 2.5 → 缎带 3。前层纸负责遮住枝干汇合处并包住花冠底部，
   必须使用低弧形双托口，只覆盖花苞下缘或花瓣底部，不能盖住花冠主体。
   两朵主花的方向固定，不要恢复拖拽旋转或随时间自转。
   两朵 `Camellia` 共享手势状态；不要为了局部样式拆成大量 DOM 节点。
7. **细枝小花必须保持自然不对称**：左右枝长、花朵数量、尺寸和朝向都要有差异，
   花瓣数和边缘也要有差异；小花必须清楚可辨，不要缩成背景噪点，也不要恢复成等距五瓣花模板。
   小白花使用独立透明图层并按 `spread` 错峰开合，不要重新烘焙成静态纸张纹理。
   装饰枝使用不同的不规则控制点与 centripetal 曲线，不要简化成对称放射线或等距波浪线。
8. **所有花枝也使用粒子**：主枝和装饰细枝使用折线路径采样并加入半径抖动，
   数量约为花朵粒子的 16%（桌面 2560 / 移动端 1440），
   不要改回实心 TubeGeometry。
   所有枝干必须共享同一个 `TIE_POINT` 并汇入缎带束口；主枝另一端进入花苞内部，
   装饰枝端点必须有可见小花，不能留下悬浮枝或空枝。
9. **花库与体验页分离**：`index.html` 只负责花库和入口，不初始化 WebGL；每朵花使用独立体验页。
   当前两朵花分别使用 `camellia.html` 与 `snowflake.html`，不要把所有花重新堆进根页面。
10. **PWA 核心资源预缓存、MediaPipe 独立缓存**：手部模型不进入安装阶段的 `cache.addAll`，
    由 `HandTracker` 下载到 `duoduo-hand-assets-v1` 并显示真实进度；SW 升级时不得删除该缓存。
    修改页面、样式、脚本或图标后必须提升 `sw.js` 的 `CACHE` 版本。
11. **雪花必须先捕捉再控制**：`search` 阶段只让手部位置吸附飘雪，进入 `captured` 后才把
    tension 映射为晶花盛开；演示模式只有指针真实移动或点击后才参与捕捉，避免自动锁住雪花。
12. **雪花变体必须贯穿贴图、捕捉对象与大型几何**：`Snowfall.item.variant` 决定空中小图，
    捕捉后由 `Snowflake.setVariant()` 重建同一型大型粒子几何；不要退回所有雪片共用一个绽放模型。
    `captured` 阶段仍要调用 `snowfall.update(dt)`，未抓住的雪片必须持续下落。
13. **手部模型必须本地优先、弱网可恢复**：加载时显示百分比，单个文件 20 秒无进度才切换备用源；
    失败时保留摄像头与视频流，由用户点「重试」，不要立即关闭摄像头退回演示模式。

## 四、核心公式

**张开度 tension**（`handTracker.js`）：

```
reach_f     = |指尖 - 手腕| / |指根 - 手腕|          // 握拳 ~1.1，张开 ~2.2
reachScore  = clamp((reach_f - 1.18) / 0.87, 0, 1)
straight    = clamp((θ_pip/π - 0.33) / 0.33, 0, 1)   // 指节伸直度，抗透视压缩
ext_f       = 0.62·reachScore + 0.38·straight
tension     = Σ(w_f·ext_f)/Σw_f                     // 拇指 .70，其余 .85~1.00
```

**绽放映射**（`main.js`）：

```js
const targetSpread = smoothstep(0.32, 0.66, tension);
const k = 1 - Math.pow(1 - 0.1, dt * 60);   // 60fps 时 k === 0.1
spread += (targetSpread - spread) * k;      // 高刷屏不会加速
```

**花瓣轮廓**（`flowerGeometry.js`）：

```
W(t) = Wmax · t^0.55 · (1 − t⁴)^0.5
```

这个形状是"像不像山茶"的关键：到 t≈0.75 才收顶、t=0.95 仍有约一半宽度 → 宽圆瓣顶。
换成 `sin` 那类尖端收敛到 0 的曲线，粒子云的瓣尖会变成尖角，看起来像百合或碎冰。

## 五、调参入口

| 位置 | 参数 | 作用 |
|---|---|---|
| `main.js` `CFG` | `CLOSED_AT` / `OPEN_AT` | 阈值 0.32 / 0.66 |
| | `SPREAD_EASE` | 绽放缓动，0.1 |
| | `TENSION_TAU_OPEN/CLOSE` | 手部平滑 0.085 / 0.055 s |
| `flowerGeometry.js` `WHORLS` | `petals/beta/L/W/rBase/cup/curl/twist` | 每轮花瓣姿态（花苞与盛放各一套） |
| `flowerGeometry.js` `PALETTE` | 花瓣白 / 花药金 / 背景 | 三色平涂 |
| `flower.js` uniforms | `uGain`(0.8) | 全局亮度 |
| | `uSizeMul`(1.5) | 粒子大小 |
| | `pitch`(0.80 ≈ 46°) | 相机俯角，也可用 `?pitch=` |
| `backdrop.js` | `near/mid/far` 三个颜色 | 背景墨绿深度 |

URL 调试参数：`?spread=0.5`（锁定绽放度并跳过开场页）、`?demo=1`、`?particles=20000`、`?pitch=0.42`；
雪花页另支持 `?variant=0..3`（羽状 / 板晶 / 叶瓣 / 密晶）。

## 六、未完成 / 待确认

1. **视觉是否达标等待确认**。山茶当前为 9/8/6 = 23 片重瓣；雪花已有四种六向晶体结构。
   浏览器成片已确认两朵花有独立轮廓，但仍需真人最终确认审美效果。
2. **移动端未真机测试**。390px 视口与触控演示已通过浏览器检查，但尚未跑真实手机摄像头。
3. **运行时依赖本地优先**。Three.js 与 `@mediapipe/hands@0.4.1675469240`
   的 wasm / 模型都放在 `vendor/`，发布时必须整目录上传；备用 CDN 只用于弱网兜底。
4. **手部识别精度未用真人数据校准**。tension 的系数（1.18 / 0.87 / 0.62 / 0.38）
   是基于合成手型推的，真人可能偏灵敏或偏迟钝，需要现场微调。

## 七、验证手段（没有浏览器时也能用）

```bash
node tools/check.mjs                    # 64 项断言
node tools/preview.mjs                  # 渲出 preview-out/*.png
PARTICLES=14000 node tools/preview.mjs  # 换粒子数

# 离线渲染器的环境变量
PREVIEW_W=1200 PREVIEW_H=820 PREVIEW_PITCH=0.80 \
GAIN=0.8 SIZE_MUL=1.5 TONE=clamp EXPOSURE=1.0 \
STATES="0,0.3,0.55,0.8,1" STRIP=1 \
node tools/preview.mjs
```

`preview.mjs` 用与着色器**同构**的投影、假光照、软核叠加把粒子光栅化，
所以造型可以完全脱离浏览器迭代——这是这个项目能在一台没有浏览器的机器上做完的原因。

## 八、这台机器的坑（写给人看）

- **没装 git**。推送是走 GitHub Git Data API 完成的（blob → tree → commit → ref）。
  空仓库不能建 blob（409），要先做一次引导提交。
- **PowerShell 双引号里 `$(...)` 会被当子表达式展开**。用字符串替换改 JS 代码时，
  含 `$('id')` 或模板字符串的内容会被吃掉。要么用单引号 / here-string，要么直接用编辑工具。
- **headless Chrome / Edge 起不来**（进程挂死），所以没法截图验证。
- 外网 API 偶有 TLS 超时；当前运行时已不依赖外网，只有发布和更新依赖时需要联网。

## 九、许可

MIT。花朵几何与着色器为原创实现。
