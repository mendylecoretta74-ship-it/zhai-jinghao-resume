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

  /* ---------- 尺寸与 DPR ---------- */
  var W = 0, H = 0;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    scene.width = W * dpr; scene.height = H * dpr;
    scene.style.width = W + "px"; scene.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

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
      title: "电工（三级）认定报名统筹",
      desc: "124 名学生 · 4 个班级 · 全流程零差错。",
      meta: "报名组织 — 信息核对 — 材料报送",
      img: "assets/images/evidence-rosters.png",
      links: [
        { label: "作品集 PDF", href: "assets/files/作品集-翟靖昊-行政方向-20260812.pdf", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    },
    {
      title: "会议纪要智能分析工作台",
      desc: "独立开发 · 导入 → 分析 → 导出全自动链路。",
      meta: "独立开发 — AI 工作流 — 在线 Demo",
      img: "assets/images/workbench-overview.png",
      links: [
        { label: "在线 Demo", href: "workbench/index.html", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    },
    {
      title: "作品集与档案体系",
      desc: "8 页作品集 · 公文样例 · C01-C21 档案分类。",
      meta: "作品集 — 公文写作 — 档案管理",
      img: "assets/images/page-1.png",
      links: [
        { label: "作品集 PDF", href: "assets/files/作品集-翟靖昊-行政方向-20260812.pdf", blank: true },
        { label: "简历 DOCX", href: "assets/files/简历-翟靖昊.docx", blank: false }
      ]
    }
  ];

  var idx = 0;
  var imgs = [];
  function loadImages() {
    projects.forEach(function (p, i) {
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
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");

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
  }

  function prev() { idx = (idx - 1 + projects.length) % projects.length; renderCarousel(); }
  function next() { idx = (idx + 1) % projects.length; renderCarousel(); }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  });

  renderCarousel();
  loadImages();

  /* ---------- 导航与 scrollspy ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a[data-target]"));

  function goTo(target) {
    var sec = document.querySelector('[data-section="' + target + '"]');
    if (sec) viewport.scrollTo({ top: sec.offsetTop, behavior: reduce ? "auto" : "smooth" });
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
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { titleReady = true; });
  } else {
    titleReady = true;
  }

  function scrollTop() { return viewport.scrollTop; }

  function drawTitle(yOff, fade) {
    if (!titleReady || fade <= 0) return;
    var size = Math.max(64, W / 16);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + size + "px \"STIX Two Text\", \"Noto Serif SC\", \"Songti SC\", serif";
    ctx.fillStyle = "rgba(" + FG + ", " + fade.toFixed(3) + ")";
    ctx.fillText("翟靖昊", W / 2, H * .46 + yOff);
    ctx.font = "400 13px \"STIX Two Text\", \"Noto Serif SC\", serif";
    ctx.fillStyle = "rgba(" + FG + ", " + (fade * .6).toFixed(3) + ")";
    ctx.fillText("ADMIN PORTFOLIO — 行政方向", W / 2, H * .46 + yOff + size * .85);
  }

  function drawPreview(yOff) {
    var im = imgs[idx];
    if (!im) return;
    var maxW = W * .68, maxH = H * .55;
    var s = Math.min(maxW / im.width, maxH / im.height);
    var w = im.width * s, h = im.height * s;
    ctx.globalAlpha = .92;
    ctx.drawImage(im, (W - w) / 2, H * .5 - h / 2 + yOff, w, h);
    ctx.globalAlpha = 1;
  }

  var workScreen = document.querySelector('[data-section="work"]');

  function tick() {
    smooth += (scrollTop() - smooth) * (reduce ? 1 : .08);
    var off = smooth * .45;                     // 视差：画布上移 = 滚动 × 0.45
    var fade = 1 - Math.min(1, scrollTop() / (H * .8));

    ctx.clearRect(0, 0, W, H);

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

    drawTitle(-off, fade);

    var local = scrollTop() - workScreen.offsetTop;
    if (local > -H * .5 && local < H * 1.5) {
      drawPreview(-off);
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", function () { resize(); });
  resize();
  requestAnimationFrame(tick);
})();
