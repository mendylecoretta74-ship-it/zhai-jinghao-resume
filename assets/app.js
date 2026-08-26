/* =========================================================
   翟靖昊 · 行政方向求职作品集
   ANIME CUTSCENE × COMIC STORYBOARD
   GSAP + ScrollTrigger · 粒子 · 视差 · 项目弹层
   ========================================================= */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var isWechat = /MicroMessenger/i.test(navigator.userAgent);

  /* -------------------------------------------------------
     顶部导航：滚动态 + 章节高亮
     ------------------------------------------------------- */
  var nav = $("#topNav");
  var chLinks = $$(".ch-link");

  function setActive(id) {
    chLinks.forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("href") === "#" + id);
    });
  }

  if (typeof ScrollTrigger !== "undefined") {
    $$(".chapter").forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: function (self) { if (self.isActive) setActive(sec.id); }
      });
    });
    ScrollTrigger.create({
      start: 30,
      onUpdate: function (self) { nav.classList.toggle("scrolled", self.scroll() > 30); }
    });
  }

  window.addEventListener("scroll", function () {
    nav.classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });

  /* -------------------------------------------------------
     背景粒子（缓慢漂浮，性能优先）
     ------------------------------------------------------- */
  var canvas = $("#particles");
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var parts = [];
    var W = 0, H = 0;
    var COLORS = ["rgba(232,180,74,", "rgba(85,200,218,", "rgba(244,241,232,"];

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParts() {
      parts = [];
      var count = Math.min(46, Math.max(24, Math.floor(W / 32)));
      for (var i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.8 + 0.6,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -Math.random() * 0.22 - 0.04,
          a: Math.random() * 0.32 + 0.08,
          c: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
        if (p.x < -6) p.x = W + 6;
        if (p.x > W + 6) p.x = -6;
        var tw = 0.6 + 0.4 * Math.sin(Date.now() / 1400 + i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + (p.a * tw).toFixed(3) + ")";
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    var visible = true;
    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      if (visible) requestAnimationFrame(tick);
    });

    resize();
    initParts();
    window.addEventListener("resize", function () { resize(); initParts(); }, { passive: true });
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------
     Hero：滚动视差 + 卡片 3D 倾斜
     ------------------------------------------------------- */
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined" && !reduceMotion) {
    $$("[data-depth]").forEach(function (el) {
      var d = parseFloat(el.getAttribute("data-depth")) || 0;
      gsap.to(el, {
        y: -90 * d * 2,
        ease: "none",
        scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: true }
      });
    });
  }

  var heroPanel = $("#heroPanel");
  var hero = $("#home");
  if (heroPanel && hero && !isTouch && !reduceMotion) {
    hero.addEventListener("mousemove", function (e) {
      var r = heroPanel.getBoundingClientRect();
      var rx = ((e.clientY - r.top) / r.height - 0.5) * -8;
      var ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
      heroPanel.style.transform = "rotate(-2deg) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
    });
    hero.addEventListener("mouseleave", function () {
      heroPanel.style.transform = "";
    });
  }

  /* -------------------------------------------------------
     滚动显现（GSAP ScrollTrigger）
     ------------------------------------------------------- */
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.fromTo(el, { autoAlpha: 0, y: 30 }, {
        autoAlpha: 1, y: 0,
        duration: 0.75,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });
  } else {
    $$(".reveal").forEach(function (el) { el.style.opacity = 1; });
  }

  /* -------------------------------------------------------
     技能条填充
     ------------------------------------------------------- */
  if (typeof ScrollTrigger !== "undefined") {
    $$(".skill-card").forEach(function (card) {
      ScrollTrigger.create({
        trigger: card,
        start: "top 85%",
        once: true,
        onEnter: function () { card.classList.add("on"); }
      });
    });
  } else {
    $$(".skill-card").forEach(function (card) { card.classList.add("on"); });
  }

  /* -------------------------------------------------------
     项目数据与详情弹层（镜头推进）
     ------------------------------------------------------- */
  var archiveData = [
    ["C01", "学生花名册与基本信息", "各班名单、花名册、录取与学籍信息、新生导入表等基础信息", 76, "31.4 MB"],
    ["C02", "成绩与排名", "期末成绩、平均成绩、班级/专业排名、成绩汇总表", 38, "3 MB"],
    ["C03", "综合素质测评", "综合素质测评表、每月综合成绩与扣分明细、评价排名", 54, "25.8 MB"],
    ["C04", "考试报名与考证", "英语A/B级、英语四级、日语四级、电工四级等报名与报考材料", 354, "45.8 MB"],
    ["C05", "奖助学金与困难补助", "国家励志奖学金、助学金、特困补助、助学贷款相关材料", 21, "1.6 MB"],
    ["C06", "家庭经济信息", "六类/非六类家庭经济困难学生信息录入表", 15, "3.5 MB"],
    ["C07", "党团建设材料", "团员名单与评议、入党积极分子与党员发展全流程材料", 91, "210.8 MB"],
    ["C08", "荣誉证书与评优评先", "三好学生、优秀干部、优秀团员、优秀毕业生审批与证书照片", 43, "32 MB"],
    ["C09", "学籍证明与火车票优惠", "学籍证明、团体学籍名册、高铁学生票购票信息", 31, "3.6 MB"],
    ["C10", "班级日常管理", "班会记录与总结、放假留校名单、值岗值日、考勤照片", 59, "49.4 MB"],
    ["C11", "课程教学与学习资料", "课表、课程标准与考核方案、复习题、考场安排、教学PPT", 55, "10 MB"],
    ["C12", "就业与职业规划", "职业生涯规划书、规划大赛通知、求职简历、就业展示PPT", 22, "68.9 MB"],
    ["C13", "毕业论文与毕业设计", "电气专业毕业设计论文（PLC、电梯、交通灯、喷泉等）", 17, "15 MB"],
    ["C14", "学生证件照与电子照片", "按班级/身份证号存放的学生电子证件照及压缩包", 932, "2.16 GB"],
    ["C15", "活动照片与班级照片", "网课照片、班级集体照片与视频", 29, "33.6 MB"],
    ["C16", "安全与主题教育活动", "国家安全、防溺水、消防、反诈、宪法、征文等主题教育材料", 21, "53.4 MB"],
    ["C17", "生活事务与通知", "医保参保须知与政策、城乡居民批量采集、献血指导", 7, "4.7 MB"],
    ["C18", "工作总结与述职报告", "辅导员/教师学期工作总结、述职报告、公众号宣传稿", 7, "78.4 MB"],
    ["C19", "创新创业项目", "学生创业计划书（环保水瓶、茶舍等）", 3, "0.1 MB"],
    ["C20", "学生个人材料与作业", "学生个人专属材料、课程作业与个人文稿", 10, "1.3 MB"],
    ["C21", "其他未分类杂项", "空文档、临时文件、录音、来源不明文件，建议人工核对", 19, "7.1 MB"]
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var shot = function (src, alt, cap) {
    return '<figure class="pm-shot" data-lightbox="' + src + '" role="button" tabindex="0" aria-label="放大查看：' + esc(cap) + '">' +
      '<img src="' + src + '" alt="' + esc(alt) + '" loading="lazy">' +
      '<figcaption><span>' + esc(cap) + '</span><svg class="icon"><use href="#i-search"/></svg></figcaption></figure>';
  };

  var projects = {
    p1: {
      ch: "CH.03-01 · 统筹篇",
      title: "电工（三级）认定报名统筹",
      tag: "124 名学生 · 4 个班级 · 报名组织 / 信息核对 / 材料报送 · 全流程零差错",
      body: function () {
        return (
          '<p class="pm-lead">毕业季学校组织 124 名学生（4 个班级）申报电工（三级）职业技能等级认定：材料含身份信息、学籍、照片与申报条件证明，标准严格、节点集中。作为项目统筹，目标是全流程零差错、按时完成。</p>' +
          '<h4>STAR · 情境 / 任务 / 行动 / 结果</h4>' +
          '<div class="pm-grid">' +
            '<div class="pm-cell"><b>情境</b><span>学校组织 124 名学生、4 个班级统一申报认定</span></div>' +
            '<div class="pm-cell"><b>任务</b><span>统筹信息采集、核对、名册整理与材料报送</span></div>' +
            '<div class="pm-cell"><b>行动</b><span>Excel 汇总表逐项核对，交叉复核申请表与团体名册</span></div>' +
            '<div class="pm-cell"><b>结果</b><span>124 人全部按时完成 · 全流程零差错</span></div>' +
          '</div>' +
          '<h4>工作流 · WORKFLOW</h4>' +
          '<div class="pm-flow"><span>导入 报名信息汇总表</span><i>→</i><span>分析 逐项核对 · 交叉复核</span><i>→</i><span>导出 报送归档 · 零差错</span></div>' +
          '<h4>实物材料 · EVIDENCE</h4>' +
          '<div class="pm-imgs">' +
            shot("assets/images/evidence-rosters.png", "学校团体学籍名册节选（已脱敏）", "学校团体学籍名册（节选）") +
            shot("assets/images/evidence-checklist.png", "报名信息核对表节选（已脱敏）", "报名信息核对表（节选）") +
          '</div>' +
          '<p class="pm-note">第 6–7 页为本人统筹报名时的实物材料，身份证号、联系方式、学号等均已脱敏；经手材料全流程零差错，并支撑 6 类学生事务顺利落地。</p>'
        );
      },
      actions: '<a class="btn btn-dark" href="assets/files/作品集-翟靖昊-行政方向-20260812.pdf" target="_blank" rel="noopener"><svg class="icon"><use href="#i-file"/></svg>查看作品集 PDF 第 6–7 页</a>'
    },
    p2: {
      ch: "CH.03-02 · 未来篇",
      title: "会议纪要智能分析工作台",
      tag: "独立开发 · 全流程负责 · 2026.07–2026.08 · 已完成可交互原型",
      body: function () {
        return (
          '<p class="pm-lead">会议纪要整理高频、重复、耗时，人工逐条处理易遗漏。独立立项，搭建「导入 → 结构化分析 → 摘要/决策/行动项/时间线 → SOP 建议 → 导出归档」全自动工作台，并跑通「业务痛点 → 竞品调研 → 流程拆解 → 落地沉淀」完整链路。</p>' +
          '<h4>核心功能 · FEATURES</h4>' +
          '<div class="pm-features">' +
            '<div><b>一键导入</b><span>txt / md / srt / vtt / docx 文稿 · 拖拽或点击</span></div>' +
            '<div><b>结构化分析</b><span>摘要 / 决策 / 行动项 / 时间线 / SOP 建议</span></div>' +
            '<div><b>导出归档</b><span>复制 · TXT · 真实 DOCX · 打印 / PDF</span></div>' +
          '</div>' +
          '<h4>界面预览 · SCREENSHOTS</h4>' +
          '<div class="pm-imgs">' +
            shot("assets/images/workbench-overview.png", "会议纪要智能分析工作台总览", "工作台总览 · 会议库与行动项追踪") +
            shot("assets/images/workbench-analysis.png", "会议纪要结构化分析页", "结构化分析 · 摘要 / 决策 / 行动项 / 时间线") +
          '</div>' +
          '<h4>技术栈 · STACK</h4>' +
          '<div class="pm-chips"><span>HTML / CSS / JS</span><span>GSAP</span><span>mammoth.js</span><span>docx.js</span><span>本地离线可用</span></div>' +
          '<p class="pm-note">全部数据仅保存在本机浏览器，可放心在线体验导入 / 分析 / 导出全流程；目前作为个人能力展示项目，尚未投入实际企业使用。</p>'
        );
      },
      actions: '<a class="btn btn-accent" href="workbench/index.html" target="_blank" rel="noopener"><svg class="icon"><use href="#i-spark"/></svg>打开在线 Demo</a>'
    },
    p3: {
      ch: "CH.03-03 · 资料篇",
      title: "作品集与档案体系",
      tag: "8 页求职作品集 · 公文写作样例 · C01–C21 档案分类 · 约 2.8 GB",
      body: function () {
        return (
          '<p class="pm-lead">8 页求职作品集，重点展示两张报名材料实物样例；配套公文写作样例与 21 类档案分类体系（C01–C21 连续无缺口）。</p>' +
          '<h4>作品集预览 · PORTFOLIO</h4>' +
          '<div class="pm-imgs">' +
            shot("assets/images/page-1.png", "作品集封面：定位与核心数据", "01 封面 · 定位与核心数据") +
            shot("assets/images/page-6.png", "个人评价申请表（已脱敏）", "06 工作样例 · 个人评价申请表（脱敏）") +
            shot("assets/images/page-7.png", "团体学籍名册节选（已脱敏）", "07 工作样例 · 团体学籍名册（脱敏）") +
            shot("assets/images/page-8.png", "作品集尾页：自我评价与联系方式", "08 尾页 · 自我评价与联系方式") +
          '</div>' +
          '<h4>公文写作样例 · WRITING SAMPLE</h4>' +
          '<div class="pm-features"><div><b>国家安全教育征文</b><span>独立撰写的主题教育征文样例，可查看公文、宣传稿的文字组织与表达规范 · DOCX 可下载</span></div></div>' +
          '<h4>档案体系 · ARCHIVE SYSTEM</h4>' +
          '<div class="pm-archive-tools">' +
            '<label class="pm-search"><svg class="icon"><use href="#i-search"/></svg><input id="archiveSearch" type="search" placeholder="搜索分类名称或用途，如：考试、成绩、党团"></label>' +
            '<a class="btn btn-dark btn-sm" href="assets/files/档案体系总览-脱敏版.xlsx" download><svg class="icon"><use href="#i-download"/></svg>总览表</a>' +
          '</div>' +
          '<div class="pm-archive" id="pmArchive"></div>' +
          '<p class="pm-note">本站仅展示分类元数据，不含任何第三方学生个人信息；原始文件未做任何修改。以上荣誉与资质均可在学校存档材料中查证，证书原件备查。</p>'
        );
      },
      actions:
        '<a class="btn btn-dark" href="assets/files/作品集-翟靖昊-行政方向-20260812.pdf" target="_blank" rel="noopener"><svg class="icon"><use href="#i-file"/></svg>查看完整作品集 PDF</a>' +
        '<a class="btn btn-ghost-dark" href="assets/files/作品集-翟靖昊-行政方向-20260812.pdf" download><svg class="icon"><use href="#i-download"/></svg>下载 PDF</a>' +
        '<a class="btn btn-ghost-dark" href="assets/files/公文写作样例-国家安全教育征文.docx" download><svg class="icon"><use href="#i-download"/></svg>下载征文样例</a>'
    }
  };

  var modal = $("#pModal");
  var pmCh = $("#pmCh");
  var pmTitle = $("#pmTitle");
  var pmTag = $("#pmTag");
  var pmBody = $("#pmBody");

  function renderArchive() {
    var grid = $("#pmArchive");
    if (!grid) return;
    grid.innerHTML = "";
    archiveData.forEach(function (row) {
      var el = document.createElement("div");
      el.className = "pm-arc";
      el.setAttribute("data-search", (row[0] + " " + row[1] + " " + row[2]).toLowerCase());
      el.innerHTML =
        '<div class="pm-arc-top"><code>' + row[0] + '</code></div>' +
        '<h5>' + row[1] + '</h5><p>' + row[2] + '</p>' +
        '<small><span>' + row[3] + ' 份</span><span>' + row[4] + '</span></small>';
      grid.appendChild(el);
    });
  }

  function filterArchive(q) {
    var query = (q || "").trim().toLowerCase();
    $$(".pm-arc").forEach(function (item) {
      item.classList.toggle("hidden", !!query && item.getAttribute("data-search").indexOf(query) === -1);
    });
  }

  function openProject(id) {
    var p = projects[id];
    if (!p) return;
    pmCh.textContent = p.ch;
    pmTitle.textContent = p.title;
    pmTag.textContent = p.tag;
    pmBody.innerHTML = p.body();
    var foot = document.createElement("div");
    foot.className = "pm-actions";
    foot.innerHTML = p.actions;
    pmBody.appendChild(foot);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderArchive();
    bindModal();
    var search = $("#archiveSearch");
    if (search) search.addEventListener("input", function () { filterArchive(this.value); });
    requestAnimationFrame(function () { $(".pm-close").focus(); });
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    pmBody.innerHTML = "";
  }

  function bindModal() {
    $$("[data-pm-close]").forEach(function (el) {
      el.onclick = closeModal;
    });
    $$("[data-lightbox]", modal).forEach(bindLightbox);
  }

  $$(".cover-card").forEach(function (card) {
    function open() { openProject(card.getAttribute("data-project")); }
    card.addEventListener("click", open);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });

  /* -------------------------------------------------------
     灯箱
     ------------------------------------------------------- */
  var lightbox = $("#lightbox");
  var lightboxImg = $("#lightboxImg");

  function bindLightbox(el) {
    function open() {
      lightboxImg.src = el.getAttribute("data-lightbox");
      lightbox.hidden = false;
    }
    el.addEventListener("click", open);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }
  $$("[data-lb-close]").forEach(function (el) { el.addEventListener("click", closeLightbox); });

  /* -------------------------------------------------------
     移动端章节菜单
     ------------------------------------------------------- */
  var menuOverlay = $("#menuOverlay");
  var menuOpen = false;
  function openMenu() {
    menuOpen = true;
    menuOverlay.classList.add("open");
    menuOverlay.setAttribute("aria-hidden", "false");
    $("#menuClose").focus();
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    menuOpen = false;
    menuOverlay.classList.remove("open");
    menuOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  $("#menuBtn").addEventListener("click", openMenu);
  $("#menuClose").addEventListener("click", closeMenu);
  $$(".menu-link").forEach(function (l) { l.addEventListener("click", closeMenu); });

  /* -------------------------------------------------------
     分享：复制链接 + 二维码
     ------------------------------------------------------- */
  var shareModal = $("#shareModal");
  var shareUrl = function () { return location.href.split("#")[0]; };

  function buildQR(url) {
    var box = $("#qrCode");
    box.innerHTML = "";
    try {
      var qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag(5, 8);
    } catch (e) {
      box.innerHTML = '<p style="font-size:12px;color:#6E747E">二维码生成失败</p>';
    }
  }

  function openShare() {
    var url = shareUrl();
    $("#shareUrlText").textContent = url;
    buildQR(url);
    $(".qr-tip").textContent = isWechat ? "点击右上角「···」转发给朋友，或长按二维码识别" : "微信内长按二维码识别，或复制链接发送给朋友";
    $("#copyLabel").textContent = "复制链接";
    shareModal.hidden = false;
    requestAnimationFrame(function () { $(".share-close").focus(); });
  }
  function closeShare() { shareModal.hidden = true; }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    return new Promise(function (resolve) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); resolve(true); } catch (e) { resolve(false); }
      document.body.removeChild(ta);
    });
  }
  $("#shareCta").addEventListener("click", openShare);
  $$("[data-share-close]").forEach(function (el) { el.addEventListener("click", closeShare); });
  $("#copyLinkBtn").addEventListener("click", function () {
    copyText(shareUrl()).then(function (ok) {
      $("#copyLabel").textContent = ok ? "已复制" : "复制失败";
      setTimeout(function () { $("#copyLabel").textContent = "复制链接"; }, 1800);
    });
  });

  /* -------------------------------------------------------
     键盘
     ------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!lightbox.hidden) { closeLightbox(); return; }
      if (!modal.hidden) { closeModal(); return; }
      if (!shareModal.hidden) { closeShare(); return; }
      if (menuOpen) { closeMenu(); return; }
    }
  });
})();
