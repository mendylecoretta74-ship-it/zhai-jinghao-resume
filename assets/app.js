/* =========================================================
   翟靖昊 · 行政方向求职作品集
   URBAN COMIC MONOCHROME · 漫画翻页交互
   GSAP core + qrcode
   ========================================================= */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isWechat = /MicroMessenger/i.test(navigator.userAgent);
  var staticMode = /[?&]static\b/.test(location.search);

  /* -------------------------------------------------------
     翻页状态
     ------------------------------------------------------- */
  var pageEls = $$(".page");
  var total = pageEls.length;
  var current = 0;
  var locked = false;
  var counted = false;

  var pageMeta = [
    { id: "cover",   name: "封面",     en: "COVER" },
    { id: "job",     name: "岗位解读", en: "JOB BRIEF" },
    { id: "match",   name: "能力匹配", en: "CAPABILITY" },
    { id: "project", name: "项目展示", en: "PROJECT" },
    { id: "results", name: "成果指标", en: "RESULTS" }
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function updateChrome() {
    var m = pageMeta[current];
    $$(".flip-dot").forEach(function (d, i) {
      d.classList.toggle("active", i === current);
      d.setAttribute("aria-selected", i === current ? "true" : "false");
    });
    var counter = $("#flipCount");
    if (counter) counter.textContent = pad(current) + " / " + pad(total - 1);
    var title = $("#topbarTitle");
    if (title) title.textContent = pad(current) + " · " + m.name;
    if (history.replaceState) history.replaceState(null, "", "#" + m.id);
  }

  function revealPage(page) {
    var els = $$(".reveal", page);
    if (reduceMotion || staticMode || !els.length || typeof gsap === "undefined") return;
    gsap.fromTo(els, { autoAlpha: 0, y: 26 }, {
      autoAlpha: 1, y: 0,
      duration: 0.55,
      stagger: 0.05,
      ease: "power3.out",
      delay: 0.16,
      clearProps: "all",
      overwrite: "auto"
    });
  }

  function runCounters() {
    if (counted) return;
    counted = true;
    $$(".stat-num[data-count]").forEach(function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      if (reduceMotion || staticMode) { el.textContent = target; return; }
      var o = { v: 0 };
      gsap.to(o, {
        v: target,
        duration: 1.3,
        ease: "power2.out",
        onUpdate: function () { el.textContent = Math.round(o.v); }
      });
    });
  }

  function activate(i) {
    var out = pageEls[current];
    var inn = pageEls[i];
    current = i;
    out.classList.remove("active");
    inn.classList.add("active");
    inn.scrollTop = 0;
    updateChrome();
    revealPage(inn);
    if (i === total - 1) runCounters();
    if (menuOpen) closeMenu();
  }

  function goTo(i, dir) {
    if (locked || i === current) return;
    if (i < 0) i = total - 1;
    if (i >= total) i = 0;
    if (reduceMotion) { activate(i); return; }

    locked = true;
    var out = pageEls[current];
    var inn = pageEls[i];
    var rot = (dir < 0 ? 1 : -1) * 1.2;

    var tl = gsap.timeline({ onComplete: function () { locked = false; } });
    tl.to(out, {
        autoAlpha: 0, y: -34, rotation: rot,
        duration: 0.26, ease: "power2.in",
        onComplete: function () {
          activate(i);
          gsap.set(out, { clearProps: "transform" });
        }
      })
      .set("#flash", { autoAlpha: 1 })
      .to("#flash", { autoAlpha: 0, duration: 0.12, ease: "power2.out" })
      .fromTo(inn, { y: 44, scale: 0.975, autoAlpha: 0 }, {
        y: 0, scale: 1, autoAlpha: 1,
        duration: 0.5, ease: "power3.out"
      });
  }

  /* 数据跳转（目录 / 圆点 / CTA） */
  $$("[data-go]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (el.tagName === "A") e.preventDefault();
      var target = parseInt(el.getAttribute("data-go"), 10);
      if (!isNaN(target)) goTo(target, target > current ? 1 : -1);
    });
  });
  $("#prevBtn").addEventListener("click", function () { goTo(current - 1, -1); });
  $("#nextBtn").addEventListener("click", function () { goTo(current + 1, 1); });

  /* -------------------------------------------------------
     键盘翻页
     ------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (menuOpen) { closeMenu(); return; }
      if (!shareModal.hidden) { closeShare(); return; }
      if (!lightbox.hidden) { closeLightbox(); return; }
    }
    if (menuOpen || !shareModal.hidden || !lightbox.hidden) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowLeft") goTo(current - 1, -1);
    if (e.key === "ArrowRight") goTo(current + 1, 1);
    if (e.key === "Home") goTo(0, -1);
    if (e.key === "End") goTo(total - 1, 1);
  });

  /* -------------------------------------------------------
     触摸左右滑动翻页
     ------------------------------------------------------- */
  var sx = null, sy = null;
  $("#stage").addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") return;
    sx = e.clientX; sy = e.clientY;
  }, { passive: true });
  $("#stage").addEventListener("pointerup", function (e) {
    if (e.pointerType !== "touch" || sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null; sy = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 90) {
      goTo(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* -------------------------------------------------------
     目录面板
     ------------------------------------------------------- */
  var menu = $("#menuPanel");
  var menuOpen = false;
  function openMenu() {
    menuOpen = true;
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    $("#menuClose").focus();
  }
  function closeMenu() {
    menuOpen = false;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
  }
  $("#menuBtn").addEventListener("click", openMenu);
  $("#menuClose").addEventListener("click", closeMenu);

  /* -------------------------------------------------------
     分享：复制链接 / 二维码 / 系统分享 / 微信提示
     ------------------------------------------------------- */
  var shareModal = $("#shareModal");
  var shareUrlText = $("#shareUrlText");
  var copyLabel = $("#copyLabel");
  var sysShareBtn = $("#sysShareBtn");
  var qrTip = $("#qrTip");
  var shareUrl = function () { return location.href.split("#")[0]; };

  function buildQR(url) {
    var box = $("#qrCode");
    box.innerHTML = "";
    try {
      var qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag(5, 8);
    } catch (err) {
      box.innerHTML = '<p style="font-size:12px;color:#8B8B85">二维码生成失败</p>';
    }
  }

  function openShare() {
    var url = shareUrl();
    shareUrlText.textContent = url;
    buildQR(url);
    if (isWechat) {
      qrTip.textContent = "点击右上角「···」转发给朋友，或长按二维码识别";
      sysShareBtn.hidden = true;
    } else {
      qrTip.textContent = "微信内长按二维码识别，或复制链接发送给朋友";
      sysShareBtn.hidden = !(navigator.share);
    }
    copyLabel.textContent = "复制链接";
    shareModal.hidden = false;
    requestAnimationFrame(function () { $("#shareClose").focus(); });
  }

  function closeShare() {
    shareModal.hidden = true;
  }

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

  $("#shareTopBtn").addEventListener("click", openShare);
  $("#shareCta").addEventListener("click", openShare);
  $("#shareClose").addEventListener("click", closeShare);
  $("#copyLinkBtn").addEventListener("click", function () {
    copyText(shareUrl()).then(function (ok) {
      copyLabel.textContent = ok ? "已复制" : "复制失败";
      setTimeout(function () { copyLabel.textContent = "复制链接"; }, 1800);
    });
  });
  sysShareBtn.addEventListener("click", function () {
    if (!navigator.share) return;
    navigator.share({
      title: "翟靖昊 · 行政方向求职作品集",
      text: "354 人台账 · 124 人报名统筹 · 1904 份档案整理，欢迎查看",
      url: shareUrl()
    }).catch(function () {});
  });
  $$("[data-close]", shareModal).forEach(function (el) {
    el.addEventListener("click", closeShare);
  });

  /* -------------------------------------------------------
     证据图灯箱（点击放大）
     ------------------------------------------------------- */
  var lightbox = $("#lightbox");
  var lightboxImg = $("#lightboxImg");

  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.hidden = false;
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }

  $$("[data-lightbox]").forEach(function (el) {
    el.addEventListener("click", function () {
      openLightbox(el.getAttribute("data-lightbox"));
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(el.getAttribute("data-lightbox"));
      }
    });
  });
  $$("[data-lb-close]").forEach(function (el) {
    el.addEventListener("click", closeLightbox);
  });

  /* -------------------------------------------------------
     档案体系（21 类，脱敏元数据）
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

  function renderArchive() {
    var grid = $("#archiveGrid");
    if (!grid) return;
    grid.innerHTML = "";
    archiveData.forEach(function (row) {
      var el = document.createElement("div");
      el.className = "arc-item";
      el.setAttribute("data-search", (row[0] + " " + row[1] + " " + row[2]).toLowerCase());
      el.innerHTML =
        '<div class="arc-top"><span class="arc-code">' + row[0] + '</span>' +
        '<svg class="icon arc-ico"><use href="#i-folder"/></svg></div>' +
        '<h3 class="arc-name">' + row[1] + "</h3>" +
        '<p class="arc-purpose">' + row[2] + "</p>" +
        '<div class="arc-foot"><span>' + row[3] + " 份</span><span>" + row[4] + "</span></div>";
      grid.appendChild(el);
    });
  }

  var emptyState = null;
  function filterArchive(query) {
    var q = (query || "").trim().toLowerCase();
    var visible = 0;
    $$(".arc-item", $("#archiveGrid")).forEach(function (item) {
      var match = !q || item.getAttribute("data-search").indexOf(q) !== -1;
      item.classList.toggle("hidden", !match);
      if (match) visible += 1;
    });
    if (!emptyState) {
      emptyState = document.createElement("p");
      emptyState.className = "arc-empty";
      $("#archiveGrid").appendChild(emptyState);
    }
    emptyState.textContent = visible ? "" : "未找到匹配的分类，试试其他关键词";
  }

  /* -------------------------------------------------------
     初始化
     ------------------------------------------------------- */
  var start = 0;
  var hash = location.hash.replace("#", "").toLowerCase();
  pageMeta.forEach(function (m, i) { if (m.id === hash) start = i; });

  pageEls.forEach(function (p, i) { p.classList.toggle("active", i === start); });
  current = start;
  updateChrome();
  revealPage(pageEls[start]);
  if (start === total - 1) runCounters();

  renderArchive();
  var searchInput = $("#archiveSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () { filterArchive(this.value); });
  }
})();
