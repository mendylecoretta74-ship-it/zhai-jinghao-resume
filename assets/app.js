/* =========================================================
   Shader 匹配引擎
   - 全屏 canvas：粒子场 / 画布大标题 / 项目预览
   - 内部滚动容器驱动视差（画布内容上移 = 滚动 × 0.45，lerp 阻尼 .08）
   - 单件轮播：Prev/Next 硬切 + 键盘 ← →
   - 导航 4 项 + scrollspy；hover 仅透明度
   ========================================================= */
(function () {
  "use strict";

  var scene = document.getElementById("scene");
  var viewport = document.getElementById("viewport");
  if (!scene || !viewport) return;

  var ctx = scene.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FG = "252, 249, 243"; // 暖白 #fcf9f3
  var bgImg = new Image(); bgImg.src = "assets/images/bg-lake.jpg"; // AI 高清细节修复背景图（保留原构图，适配大屏铺满）
  var bgCache = null; // 背景离屏缓存：按视口尺寸渲染一次，每帧直接 blit（省去逐帧缩放）
  var frameCount = 0; // 帧计数：连线等重计算隔帧执行，降载

  function drawBackgroundCover(target) {
    var iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
    if (!iw || !ih) return;
    var scale = Math.max(W / iw, H / ih);
    var bw = iw * scale, bh = ih * scale;
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh);
  }

  function drawEdgeTreatment() {
    var edge = ctx.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, "rgba(5,6,5,.28)");
    edge.addColorStop(.12, "rgba(5,6,5,.06)");
    edge.addColorStop(.5, "rgba(5,6,5,0)");
    edge.addColorStop(.88, "rgba(5,6,5,.06)");
    edge.addColorStop(1, "rgba(5,6,5,.28)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    var vertical = ctx.createLinearGradient(0, 0, 0, H);
    vertical.addColorStop(0, "rgba(5,6,5,.2)");
    vertical.addColorStop(.24, "rgba(5,6,5,0)");
    vertical.addColorStop(.76, "rgba(5,6,5,0)");
    vertical.addColorStop(1, "rgba(5,6,5,.22)");
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- 尺寸与 DPR ---------- */
  var W = 0, H = 0;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    scene.width = W * dpr; scene.height = H * dpr;
    scene.style.width = W + "px"; scene.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 重渲背景离屏缓存（视口尺寸变了）
    if (bgImg.complete && bgImg.naturalWidth) {
      bgCache = document.createElement("canvas");
      bgCache.width = W; bgCache.height = H;
      var bctx = bgCache.getContext("2d");
      drawBackgroundCover(bctx);
    }
    initParticles();
    if (typeof alignNavToPreview === "function") alignNavToPreview(); // resize 后按键组随预览图位置重算
  }
  bgImg.onload = function () { resize(); };

  /* ---------- 粒子场：点 + 近距连线 ---------- */
  var parts = [];
  function initParticles() {
    var count = Math.min(90, Math.max(40, Math.floor(W / 14)));
    parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - .5) * .8,   // ±0.4 px/帧
        vy: (Math.random() - .5) * .8,
        r: Math.random() * 1.5 + .4,     // 0.4–1.9px
        a: Math.random() * .5 + .3
      });
    }
  }

  function drawPoint(x, y, p) {
    ctx.fillStyle = "rgba(" + FG + ", " + (p.a * .5).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- 项目数据（单件轮播） ---------- */
  var projects = [
    {
      title: "354 人信息台账管理",
      desc: "批量录入核对与定期报送，归档零差错",
      meta: "台账维护 / 数据核验 / 定期报送",
      links: [
        { label: "作品集 PDF", href: "assets/files/作品集-翟靖昊-行政方向-网站统一版-20260828.pdf", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    },
    {
      title: "电工（三级）认定报名统筹",
      desc: "124 名学生、4 个班级，报名到报送全流程零差错",
      meta: "报名组织 / 信息核对 / 材料报送",
      img: "assets/images/evidence-rosters.png",
      links: [
        { label: "作品集 PDF", href: "assets/files/作品集-翟靖昊-行政方向-网站统一版-20260828.pdf", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    },
    {
      title: "会议纪要智能分析工作台",
      desc: "已用于真实会议材料整理，生成摘要、行动项与可导出纪要",
      meta: "独立开发 / 真实材料使用 / 行动项追踪",
      img: "assets/images/workbench-overview.png",
      links: [
        { label: "在线 Demo", href: "workbench/index.html", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    },
    {
      title: "作品集与档案体系",
      desc: "1904 份文件，C01-C21 分类，配套公文样例",
      meta: "档案分类 / 公文写作 / PDF 作品集",
      img: "assets/images/portfolio-preview-20260828.png",
      links: [
        { label: "作品集 PDF", href: "assets/files/作品集-翟靖昊-行政方向-网站统一版-20260828.pdf", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    }
  ];

  var idx = 0;
  var imgs = [];
  function loadImages() {
    projects.forEach(function (p, i) {
      if (!p.img) return;
      var im = new Image();
      im.onload = function () { imgs[i] = im; };
      im.src = p.img;
    });
  }

  var counterEl = document.getElementById("counter");
  var titleEl = document.getElementById("workTitle");
  var descEl = document.getElementById("workDesc");
  var metaEl = document.getElementById("workMeta");
  var linksEl = document.getElementById("workLinks");

  function renderCarousel() {
    var p = projects[idx];
    counterEl.textContent = String(idx + 1).padStart(2, "0") + " / " + String(projects.length).padStart(2, "0");
    titleEl.textContent = p.title;
    descEl.textContent = p.desc;
    metaEl.textContent = p.meta;
    linksEl.innerHTML = "";
    p.links.forEach(function (l) {
      var a = document.createElement("a");
      a.textContent = l.label;
      a.href = l.href;
      if (l.blank) { a.target = "_blank"; a.rel = "noopener"; }
      linksEl.appendChild(a);
    });
    if (p.img) {
      var preview = document.createElement("button");
      preview.type = "button";
      preview.className = "preview-button";
      preview.textContent = "查看项目图";
      preview.setAttribute("aria-label", "查看" + p.title + "项目图");
      preview.addEventListener("click", function (e) {
        e.stopPropagation();
        settleWorkPosition();
        openLightbox();
      });
      linksEl.appendChild(preview);
    }
    updateTabs();
  }

  /* 标题切换条：4 个项目标题，点击直达（当前项高亮） */
  function updateTabs() {
    var wrap = document.getElementById("workTabs");
    if (!wrap) return;
    if (wrap.children.length !== projects.length) {
      wrap.innerHTML = "";
      projects.forEach(function (p, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = p.title;
        b.addEventListener("click", function () { animateCarouselTo(i); });
        wrap.appendChild(b);
      });
    }
    Array.prototype.forEach.call(wrap.children, function (b, i) {
      var active = i === idx;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function jumpTo(target) { idx = (target + projects.length) % projects.length; renderCarousel(); }

  document.addEventListener("keydown", function (e) {
    var workActive = document.querySelector('.nav a[data-target="work"].active');
    if (!workActive) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); animateCarouselTo(idx - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); animateCarouselTo(idx + 1); }
  });

  renderCarousel();
  loadImages();

  /* ---------- 导航与 scrollspy ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a[data-target]"));

  function goTo(target) {
    var sec = document.querySelector('[data-section="' + target + '"]');
    if (!sec) return;
    var dest = sec.offsetTop;
    if (reduce) { viewport.scrollTop = dest; scrollTarget = dest; smooth = dest; return; }
    if (window.gsap) {
      // 导航滚动：expo.inOut 黄金缓动（快-慢-快），由 lerp 平滑缓冲 → 到站即停不震
      gsap.killTweensOf(scrollProxy);
      gsap.to(scrollProxy, { v: dest, duration: 1.0, ease: "expo.inOut", onUpdate: function () { scrollTarget = scrollProxy.v; } });
    } else {
      scrollTarget = dest;
    }
  }

  navLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      goTo(a.getAttribute("data-target"));
    });
  });

  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        var id = en.target.getAttribute("data-section");
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("data-target") === id);
        });
      }
    });
  }, { root: viewport, threshold: .55 });

  Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) {
    spy.observe(s);
  });

  /* ---------- 画布绘制：视差 + 大标题 + 项目预览 ---------- */
  var smooth = 0;
  var titleReady = false;
  // 动画状态（GSAP 驱动；无 GSAP / reduced-motion 时恒为 1 = 原样）
  var revealObj = { t: 1, p: 1, b: 1 }; // t=标题入场 b=背景/粒子浮现 p=轮播切换
  var prevImg = null, prevP = 0;   // 轮播切换：旧图交叉淡出（避免切换瞬间空白）
  var bootPlayed = false;
  function playBoot() {
    if (bootPlayed) return;
    bootPlayed = true;
    if (!window.gsap || reduce) return; // 降级：一切直接显示
    revealObj.t = 0;
    revealObj.b = 0;
    gsap.to(revealObj, { b: 1, duration: 1.1, ease: "power2.out" });          // 开场：背景与粒子从黑中浮现（1.1s）
    gsap.to(revealObj, { t: 1, duration: 1.0, ease: "power3.out", delay: 0.15 }); // 随后：标题缓入（0.15s 错峰）
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { titleReady = true; playBoot(); });
  } else {
    titleReady = true;
    playBoot();
  }

  function scrollTop() { return viewport.scrollTop; }

  /* ---------- 平滑滚动驱动：lerp 接管滚动本体，与画布视差同源（衔接顺滑） ---------- */
  var scrollTarget = 0;       // 滚动目标（wheel / 导航 / 键盘 / touch 均汇入）
  var scrollProxy = { v: 0 }; // GSAP 导航滚动代理
  var touchActive = false;

  if (viewport.scrollTop > 0) { // 刷新后浏览器恢复的滚动位置
    smooth = viewport.scrollTop;
    scrollTarget = viewport.scrollTop;
  }

  /* ---------- 全屏 snap：一次滑动 = 平滑衔接到相邻板块 ---------- */
  var snapTops = [];
  function computeSnapTops() {
    snapTops = Array.prototype.map.call(document.querySelectorAll(".screen"), function (s) { return s.offsetTop; });
    snapTops.push(viewport.scrollHeight - viewport.clientHeight); // 底部（露出页脚）
  }
  computeSnapTops();

  var snapLock = false; // 衔接动画中，后续滑动忽略（一次一屏）
  function snapTo(dir) {
    if (snapLock) return;
    var base = smooth, dest = null, i;
    if (dir > 0) {
      for (i = 0; i < snapTops.length; i++) if (snapTops[i] > base + 4) { dest = snapTops[i]; break; }
    } else {
      for (i = snapTops.length - 1; i >= 0; i--) if (snapTops[i] < base - 4) { dest = snapTops[i]; break; }
    }
    if (dest === null || Math.abs(dest - base) < 4) return; // 已在边界
    snapLock = true;
    if (window.gsap) {
      gsap.killTweensOf(scrollProxy);
      gsap.to(scrollProxy, { v: dest, duration: 0.85, ease: "expo.inOut", // 到站缓停
        onUpdate: function () { scrollTarget = scrollProxy.v; },
        onComplete: function () { snapLock = false; } });
    } else {
      scrollTarget = dest;
      setTimeout(function () { snapLock = false; }, 750); // 无 GSAP：lerp 到达后解锁
    }
  }

  viewport.addEventListener("wheel", function (e) {
    if (reduce) return; // reduced-motion：原生滚动
    e.preventDefault();
    snapTo(e.deltaY > 0 ? 1 : -1); // 一次滚轮（含触控板惯性多事件）只跳一屏
  }, { passive: false });

  var touchStartY = 0;
  viewport.addEventListener("touchstart", function (e) {
    touchActive = true;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  ["touchend", "touchcancel"].forEach(function (ev) {
    viewport.addEventListener(ev, function (e) {
      touchActive = false;
      scrollTarget = viewport.scrollTop; // 原生触摸滚动终点 → lerp 平滑接管
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > 50) snapTo(dy < 0 ? 1 : -1); // 滑动超过阈值 → 衔接下一屏
    }, { passive: true });
  });

  // 键盘 / 滚动条等原生滚动：接管为平滑目标
  viewport.addEventListener("scroll", function () {
    if (!touchActive && Math.abs(viewport.scrollTop - smooth) > 2) scrollTarget = viewport.scrollTop;
  }, { passive: true });

  /* ---------- 预览图交互：hover 跟随视差 + 微放大（lerp 平滑，rAF 驱动） ---------- */
  var lastMouseX = -1e9, lastMouseY = -1e9;
  var hoverShiftX = 0, hoverShiftY = 0, hoverScale = 1, imgHover = false, imgHoverPrev = false;
  viewport.addEventListener("mousemove", function (e) {
    lastMouseX = e.clientX; lastMouseY = e.clientY;
  }, { passive: true });
  viewport.addEventListener("mouseleave", function () {
    lastMouseX = -1e9; lastMouseY = -1e9;
  }, { passive: true });

  /* ---------- 大图预览（lightbox）：点击预览图放大查看，点击任意处 / Esc 关闭 ---------- */
  var lightbox = { active: false, img: null, p: 0, w: 0, h: 0 };
  function openLightbox() {
    var im = imgs[idx];
    if (!im || lightbox.active) return;
    lightbox.active = true;
    lightbox.img = im;
    document.body.classList.add("lightbox-open");
    var trigger = document.querySelector(".preview-button");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    var s = Math.min(W * .85 / im.width, H * .75 / im.height);
    lightbox.w = im.width * s; lightbox.h = im.height * s;
    if (reduce) lightbox.p = 1;
  }
  function closeLightbox() {
    if (!lightbox.active) return;
    lightbox.active = false;
    var trigger = document.querySelector(".preview-button");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (reduce) { lightbox.img = null; lightbox.p = 0; document.body.classList.remove("lightbox-open"); }
  }
  scene.addEventListener("click", function () { if (lightbox.active) closeLightbox(); });
  viewport.addEventListener("click", function (e) {
    if (lightbox.active) { closeLightbox(); return; }
    if (imgHover) openLightbox(); // 点击预览图本体才开
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox.active) closeLightbox();
  });

  function drawTitle(yOff, fade) {
    if (!titleReady || fade <= 0) return;
    var size = Math.max(64, W / 16);
    var t = revealObj.t; // 入场进度 0→1
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + size + "px \"STIX Two Text\", \"Noto Serif SC\", \"Songti SC\", serif";
    ctx.fillStyle = "rgba(" + FG + ", " + (fade * t).toFixed(3) + ")";
    ctx.fillText("翟靖昊", W / 2, H * .46 + yOff + (1 - t) * 30);
  }

  function drawPreview(cy) {
    var wide = window.innerWidth > 760;
    var p = wide ? layoutObj.p : 0;           // 布局进度：0=居中下方 → 1=左文右图
    var tall = H >= 900;                      // 矮视口（<900）图更小更靠下，避开文字块
    var baseCy = tall ? H * .84 : H * .9;
    cy += (H * .5 - baseCy) * p;              // 布局：图从下方升到屏幕中部（衔接动画）
    var cx = W * (.5 + .22 * p);              // 布局：居中 → 中间偏右
    var maxW = wide ? W * (.56 - .22 * p) : W * .78;  // 布局：横幅 → 右栏大图
    var maxH = H * ((tall ? .2 : .14) + (.48 - (tall ? .2 : .14)) * p);
    var im = imgs[idx];
    // 新图基准尺寸
    var w0 = 0, h0 = 0;
    if (im) { var s0 = Math.min(maxW / im.width, maxH / im.height); w0 = im.width * s0; h0 = im.height * s0; }
    // —— 交互偏移：鼠标相对图中心反向微移，lerp 平滑跟随（无图 / reduced-motion 时无交互）——
    var shiftX = 0, shiftY = 0, scale = 1;
    if (!reduce && im) {
      var boxL = cx - w0 / 2, boxT = cy - h0 / 2;
      imgHover = lastMouseX >= boxL && lastMouseX <= boxL + w0 && lastMouseY >= boxT && lastMouseY <= boxT + h0;
      var tX = imgHover ? (lastMouseX - (boxL + w0 / 2)) / (w0 / 2) : 0;
      var tY = imgHover ? (lastMouseY - (boxT + h0 / 2)) / (h0 / 2) : 0;
      hoverShiftX += (tX * 14 - hoverShiftX) * .08; // 最大偏移 14px，阻尼 .08 平滑
      hoverShiftY += (tY * 14 - hoverShiftY) * .08;
      hoverScale += ((imgHover ? 1.035 : 1) - hoverScale) * .08;
      shiftX = hoverShiftX; shiftY = hoverShiftY; scale = hoverScale;
      if (imgHover !== imgHoverPrev) { scene.style.cursor = imgHover ? "pointer" : ""; imgHoverPrev = imgHover; }
    } else if (imgHoverPrev) { scene.style.cursor = ""; imgHoverPrev = false; imgHover = false; }
    // 旧图交叉淡出（prevImg 由轮播切换设置，淡完即清）
    if (prevImg && prevP > 0.01) {
      var sp = Math.min(maxW / prevImg.width, maxH / prevImg.height);
      var wp = prevImg.width * sp * scale, hp = prevImg.height * sp * scale;
      ctx.globalAlpha = prevP;
      ctx.drawImage(prevImg, cx + shiftX - wp / 2, cy + shiftY - hp / 2, wp, hp);
      ctx.globalAlpha = 1;
    }
    if (!im) return;
    var w = w0 * scale * (0.97 + 0.03 * revealObj.p); // 微 scale：切图轻呼吸
    var h = h0 * scale * (0.97 + 0.03 * revealObj.p);
    ctx.globalAlpha = Math.min(1, revealObj.p * 6); // 快速冲过不透明阈值：稳定态恒 1，杜绝黑字/深色区透底
    ctx.drawImage(im, cx + shiftX - w / 2, cy + shiftY - h / 2, w, h);
    // hover 呼吸外框（1px 暖白，克制）
    if (imgHover && revealObj.p > .9 && !reduce) {
      ctx.strokeStyle = "rgba(252, 249, 243, .3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + shiftX - w0 / 2 - 8, cy + shiftY - h0 / 2 - 8, w0 + 16, h0 + 16);
    }
    ctx.globalAlpha = 1;
  }

  var workScreen = document.querySelector('[data-section="work"]');

  function tick() {
    frameCount++;
    smooth += (scrollTarget - smooth) * (reduce ? 1 : 0.09);
    if (!touchActive && !reduce) {
      var st = Math.round(smooth); // 整数化赋值：同值跳过，减少 layout 抖动
      if (st !== viewport.scrollTop) viewport.scrollTop = st;
    }
    var off = smooth * .45;                     // 视差：画布上移 = 滚动 × 0.45
    var fade = 1 - Math.min(1, smooth / (H * .6)); // 标题在 work 区前完全消失，避免残影重叠

    ctx.clearRect(0, 0, W, H);

    // 背景图铺底（离屏缓存直接 blit；开场随 b 浮现）
    if (bgCache) {
      ctx.globalAlpha = revealObj.b;
      ctx.drawImage(bgCache, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } else if (bgImg.complete && bgImg.naturalWidth) {
      ctx.globalAlpha = revealObj.b;
      drawBackgroundCover(ctx);
      ctx.globalAlpha = 1;
    }

    drawEdgeTreatment();

    ctx.globalAlpha = revealObj.b; // 开场：粒子随背景一起浮现（b→1 后恢复正常透明度）
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!reduce) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
      var py = p.y - off;
      drawPoint(p.x, py, p);
      drawPoint(p.x, py - H, p);
      drawPoint(p.x, py + H, p);
    }

    if (frameCount % 2 === 0) { // 连线隔帧计算（O(n²) 距离运算减半，视觉无差——连线变化缓慢）
    for (var a = 0; a < parts.length; a++) {
      for (var b = a + 1; b < parts.length; b++) {
        var dx = parts[a].x - parts[b].x;
        var dy = parts[a].y - parts[b].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 12100) { // 110²
          ctx.strokeStyle = "rgba(" + FG + ", " + (0.12 * (1 - Math.sqrt(d2) / 110)).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(parts[a].x, parts[a].y - off);
          ctx.lineTo(parts[b].x, parts[b].y - off);
          ctx.stroke();
        }
      }
    }
    } // 连线隔帧结束
    ctx.globalAlpha = 1; // 粒子层结束，恢复（预览图/标题/灯箱不受开场 alpha 影响）

    drawTitle(-off, fade);

    var local = smooth - workScreen.offsetTop;
    // 布局衔接状态机：work 屏进入（local≈0）→ 文字左移 + 图放大右移；离开 → 平滑复位
    var layoutIn = local > -60 && local < 90 && !!projects[idx].img;
    if (layoutIn !== layoutActivePrev) {
      layoutActivePrev = layoutIn;
      playLayout(layoutIn);
    }
    // 区块停靠标题过渡（字距展开：.4em → 0 + 淡入；每区块首次停靠播一次）
    var nearSec = null, bestD = 1e9;
    for (var si = 0; si < secEls.length; si++) {
      var dSec = Math.abs(smooth - secEls[si].offsetTop);
      if (dSec < bestD) { bestD = dSec; nearSec = secEls[si]; }
    }
    if (nearSec && bestD < H * .15) {
      var secName = nearSec.getAttribute("data-section");
      if (!titleAnimated[secName]) {
        titleAnimated[secName] = true;
        var hEl = nearSec.querySelector(".about-head, .contact-head, .work-title");
        if (hEl && window.gsap && !reduce) {
          gsap.fromTo(hEl, { letterSpacing: ".4em", opacity: .4 }, { letterSpacing: "0em", opacity: 1, duration: .7, ease: "power2.out", overwrite: "auto" });
        }
      }
    }
    if (local > -H && local < H * 2) {       // 宽松触发，canvas 自动裁剪视口外
      drawPreview((H >= 900 ? H * .86 : H * .9) - local); // 锚定 work 屏内容，滚动 1:1 同步进出
    }

    /* ---------- 大图预览（z 顶置：遮罩 + 大图放大入场，lerp 驱动） ---------- */
    if (lightbox.active || lightbox.p > .001) {
      if (!reduce) lightbox.p += ((lightbox.active ? 1 : 0) - lightbox.p) * .1;
      ctx.fillStyle = "rgba(0, 0, 0, " + (.94 * lightbox.p).toFixed(3) + ")"; // 遮罩加深：背景文字完全压暗，杜绝透过
      ctx.fillRect(0, 0, W, H);
      if (lightbox.img) {
        var lsc = .9 + .1 * lightbox.p;      // 微放大入场（exaggeration，克制）；图始终不透明，避免半透明透底
        var lw = lightbox.w * lsc, lh = lightbox.h * lsc;
        ctx.globalAlpha = 1;
        ctx.drawImage(lightbox.img, (W - lw) / 2, (H - lh) / 2, lw, lh);
        ctx.globalAlpha = 1;
      }
      if (!lightbox.active && lightbox.p < .01) {
        lightbox.active = false;
        lightbox.img = null;
        document.body.classList.remove("lightbox-open");
      }
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", function () { resize(); computeSnapTops(); });
  resize();
  requestAnimationFrame(tick);

  /* ========== 动画编排（迪士尼 12 法则落地；GSAP 缺失 / reduced-motion 时自动降级） ========== */
  if (window.gsap && !reduce) document.body.classList.add("has-gsap"); // 渐进增强标记：CSS 据此让出 transform 过渡

  // 1) 轮播衔接：方向感知 + 退场快进（anticipation）+ 入场缓出错峰（follow-through / overlapping）
  //    + 微过冲（exaggeration）+ 编号数字滚动（timing）
  var carAnimating = false;
  var queuedCarouselTarget = null;
  var carouselEl = document.querySelector(".carousel"); // 容器：切换时整体预备位移 + 回正
  var layoutObj = { p: 0 };          // 布局进度：0=文字居中+图下方 → 1=左文右图（GSAP 驱动）
  var layoutActivePrev = null;       // 滚动状态机：work 屏进入/离开时触发布局衔接动画
  var secEls = document.querySelectorAll(".screen");
  var titleAnimated = {};            // 区块标题字距过渡：每区块仅首次停靠播一次
  function playLayout(inLayout) {
    // 文字容器 Flip 左移/复位（手写 Flip：class 切换瞬间测位移差，fromTo 动画归零）
    var before = carouselEl.getBoundingClientRect().left;
    carouselEl.classList.toggle("work-left", inLayout);
    var after = carouselEl.getBoundingClientRect().left;
    var target = inLayout ? 1 : 0;
    if (window.gsap && !reduce) {
      gsap.fromTo(carouselEl, { x: before - after }, { x: 0, duration: .8, ease: "power3.inOut", overwrite: "auto",
        onComplete: function () {
          carouselEl.style.transform = ""; // 清 transform：nav 的 absolute 包含块回到 viewport（transform 祖先会捕获定位）
        } });
      gsap.to(layoutObj, { p: target, duration: .8, ease: "power3.inOut", overwrite: "auto" });
    } else {
      layoutObj.p = target; // 降级：布局直接切换
      carouselEl.style.transform = "";
    }
  }
  function settleWorkPosition() {
    var top = workScreen.offsetTop;
    scrollTarget = top;
    smooth = top;
    scrollProxy.v = top;
    viewport.scrollTop = top;
  }
  function animateCarouselTo(target) {
    target = (target + projects.length) % projects.length;
    if (carAnimating) {
      queuedCarouselTarget = target;
      return;
    }
    if (target === idx) return;
    var oldIdx = idx;
    var diff = target - oldIdx;                 // 环绕感知：取最短路径方向（3→0 视为 +1）
    if (diff > 1) diff -= projects.length;
    if (diff < -1) diff += projects.length;
    var dir = diff > 0 ? 1 : -1;
    if (!window.gsap || reduce) { jumpTo(target); settleWorkPosition(); return; }
    carAnimating = true;
    var items = [counterEl, titleEl, descEl, metaEl, linksEl];
    var xOut = 48 * dir, xIn = -48 * dir; // 方向感知：prev 左出右入，next 右出左入（位移加大，滑动感可见）
    var tl = gsap.timeline({ onComplete: function () {
      carAnimating = false;
      settleWorkPosition();
      if (queuedCarouselTarget !== null) {
        var nextTarget = queuedCarouselTarget;
        queuedCarouselTarget = null;
        if (nextTarget !== idx) animateCarouselTo(nextTarget);
      }
    } });
    // 预备动作：容器向切换方向微移（anticipation），随后内容滑出
    tl.to(carouselEl, { x: -10 * dir, duration: 0.12, ease: "power2.in", overwrite: "auto" })
      .to(items, { opacity: 0, x: xOut, duration: 0.3, ease: "power2.in", stagger: 0.04, overwrite: "auto" }, "-=0.1")
      .add(function () { // 内容切换 + 预览图同步归位（杜绝切换帧闪现：t=0 即旧图接管、新图 alpha 归 0）
        jumpTo(target);
        settleWorkPosition();
        var oldIm = imgs[oldIdx];
        if (oldIm && window.gsap && !reduce) {
          prevImg = oldIm;
          prevP = 1;
          var fadeObj = { p: 1 };
          gsap.to(fadeObj, { p: 0, duration: 0.22, ease: "power2.in", overwrite: "auto",
            onUpdate: function () { prevP = fadeObj.p; },
            onComplete: function () { prevImg = null; prevP = 0; } });
        }
        if (window.gsap && !reduce) {
          gsap.fromTo(revealObj, { p: 0 }, { p: 1, duration: 0.45, ease: "power2.out", delay: 0.1, overwrite: "auto" }); // 旧图先走 0.1s，新图再淡入
        } else {
          revealObj.p = 1; // 降级：新图直接全显
        }
      })
      // 入场：容器回正 + 新内容从反方向滑入（immediateRender:false → 退场独占播放，切换点后才接管，杜绝打架）
      .to(carouselEl, { x: 0, duration: 0.55, ease: "power3.out", overwrite: "auto" }, "<")
      .fromTo(titleEl, { opacity: 0, x: xIn, y: 24, scale: 0.98 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.65, ease: "power3.out", immediateRender: false, overwrite: "auto" }, "<")
      .fromTo(counterEl, { opacity: 0, x: xIn }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: false, overwrite: "auto" }, "-=0.55")
      .fromTo(descEl, { opacity: 0, x: xIn, y: 16 }, { opacity: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false, overwrite: "auto" }, "-=0.48")
      .fromTo(metaEl, { opacity: 0, x: xIn, y: 12 }, { opacity: 1, x: 0, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false, overwrite: "auto" }, "-=0.4")
      .fromTo(linksEl, { opacity: 0, x: xIn, y: 10 }, { opacity: 1, x: 0, y: 0, duration: 0.4, ease: "power3.out", immediateRender: false, overwrite: "auto" }, "-=0.34")
      .add(function () { // 编号数字滚动（timing）
        var from = oldIdx + 1, to = idx + 1, len = projects.length;
        var n = { v: from };
        gsap.to(n, { v: to, duration: 0.55, ease: "power2.out", overwrite: "auto",
          onUpdate: function () {
            counterEl.textContent = String(Math.round(n.v)).padStart(2, "0") + " / " + String(len).padStart(2, "0");
          } });
      }, "-=0.5");
  }

  // 2)（翻页按钮已移除，改为标题切换条 work-tabs；按压回弹逻辑随之删除）

  // 3) 区块首次进入：错峰 rise（staging + follow-through；只播一次）
  var revealed = {};
  var revealObserver = (!window.gsap || reduce) ? null : new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var sec = en.target, name = sec.getAttribute("data-section");
      if (revealed[name]) return;
      revealed[name] = true;
      revealObserver.unobserve(sec);
      var items = [];
      if (name === "work") items = [counterEl, titleEl, descEl, metaEl, linksEl, document.querySelector(".work-tabs")];
      else if (name === "about") items = sec.querySelectorAll(".about-head, .about-text, .about-label, .about-strengths, .about-meta > div");
      else if (name === "contact") items = sec.querySelectorAll(".contact-head, .contact-line, .cta-line");
      if (items.length) {
        gsap.fromTo(items, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.08, delay: 0.1 });
      }
    });
  }, { threshold: 0.4 });
  if (revealObserver) Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) { revealObserver.observe(s); });

  // 4) 首页能力摘要：标题之后缓入（timing 分层）
  var heroMeta = document.querySelector(".hero-meta");
  if (heroMeta && window.gsap && !reduce) {
    gsap.fromTo(heroMeta, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", delay: 1.0 });
  }
})();
