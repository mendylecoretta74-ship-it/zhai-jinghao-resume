/* =========================================================
   翟靖昊 · 行政方向求职作品集
   GSAP core + ScrollTrigger + ScrollToPlugin
   ========================================================= */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isWechat = /MicroMessenger/i.test(navigator.userAgent);

  /* -------------------------------------------------------
     顶部进度条 + 导航栏状态
     ------------------------------------------------------- */
  gsap.to("#progress", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 }
  });

  ScrollTrigger.create({
    start: 80,
    end: "max",
    onUpdate: function (self) {
      $("#topbar").classList.toggle("scrolled", self.scroll() > 64);
    }
  });

  /* -------------------------------------------------------
     章节触发器（驱动弧形导航高亮）
     ------------------------------------------------------- */
  var sections = $$("section[data-section]");
  var sectionTriggers = sections.map(function (sec, i) {
    return ScrollTrigger.create({
      trigger: sec,
      start: "top 48%",
      end: "bottom 48%",
      onToggle: function (self) {
        if (self.isActive) setActive(i);
      }
    });
  });

  /* -------------------------------------------------------
     弧形滚轮式侧边导航
     ------------------------------------------------------- */
  var wheel = $("#wheel");
  var wheelState = { rot: 0 };
  var wheelItems = [];
  var lastFilter = [];
  var activeIndex = 0;
  var R = 300;
  var STEP = 15;
  var START = -52;
  var BASE = 90;
  var clamp = gsap.utils.clamp;
  var mapRange = gsap.utils.mapRange;

  var wheelLabels = [
    ["02", "核心项目"],
    ["03", "个人定位"],
    ["04", "核心数据"],
    ["05", "行政实务"],
    ["06", "团支部"],
    ["07", "公文写作"],
    ["08", "档案体系"],
    ["09", "作品集"],
    ["10", "荣誉资质"],
    ["11", "联系方式"]
  ];

  function buildWheel() {
    if (!wheel) return;
    wheel.innerHTML = "";
    wheelItems = [];
    lastFilter = [];
    wheelLabels.forEach(function (entry, i) {
      var a = document.createElement("a");
      a.className = "w-item";
      a.href = "#" + sections[i].id;
      a.setAttribute("data-i", i);
      a.setAttribute("aria-label", "前往 " + entry[1]);
      a.innerHTML = '<span class="w-dot"></span><span class="w-num">' + entry[0] + '</span><span class="w-label">' + entry[1] + "</span>";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        gsap.to(window, {
        scrollTo: { y: "#" + sections[i].id, offsetY: -76 },
        duration: reduceMotion ? 0 : 0.9,
        ease: "power3.inOut"
        });
      });
      wheel.appendChild(a);
      wheelItems.push(a);
      lastFilter.push("");
    });
  }

  function paintWheel() {
    if (!wheelItems.length) return;
    var rot = wheelState.rot;
    wheelItems.forEach(function (item, i) {
      var angle = START + i * STEP + rot;
      var rad = angle * Math.PI / 180;
      var x = R * Math.sin(rad);
      var y = -R * Math.cos(rad);
      var d = ((angle - BASE + 540) % 360) - 180;
      var absD = Math.abs(d);
      var opacity = clamp(0.06, 1, mapRange(0, 44, 1, 0.06, absD));
      var blur = clamp(0, 3.2, mapRange(18, 44, 0, 3.2, absD));
      var scale = clamp(0.9, 1, mapRange(0, 44, 1, 0.9, absD));
      var tilt = clamp(-1, 1, absD / 15) * (d >= 0 ? 1 : -1) * 22;
      // 仅当模糊值实际变化时才写 style.filter，避免每帧触发样式重算
      var blurKey = blur > 0.08 ? blur.toFixed(2) : "";
      if (blurKey !== lastFilter[i]) {
        lastFilter[i] = blurKey;
        item.style.filter = blurKey ? "blur(" + blurKey + "px)" : "none";
      }
      gsap.set(item, { x: x, y: y, rotation: tilt, scale: scale, opacity: opacity });
    });
  }

  function setActive(i) {
    if (i === activeIndex) { paintWheel(); return; }
    activeIndex = i;
    wheelItems.forEach(function (item, idx) {
      item.classList.toggle("active", idx === i);
      item.setAttribute("aria-current", idx === i ? "true" : "false");
    });
    var targetRot = BASE - (START + i * STEP);
    if (reduceMotion) {
      wheelState.rot = targetRot;
      paintWheel();
    } else {
      gsap.to(wheelState, {
        rot: targetRot,
        duration: 1.05,
        ease: "power3.inOut",
        overwrite: "auto",
        onUpdate: paintWheel
      });
    }
  }

  function measureWheel() {
    R = window.innerWidth >= 1440 ? 312 : 272;
    document.documentElement.style.setProperty("--wheel-r", R + "px");
    paintWheel();
  }

  var wheelResizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(wheelResizeTimer);
    wheelResizeTimer = setTimeout(function () {
      measureWheel();
      ScrollTrigger.refresh();
    }, 200);
  });

  /* -------------------------------------------------------
     Hero 入场（杂志式时序）
     ------------------------------------------------------- */
  function heroIntro() {
    if (reduceMotion) return;
    var tl = gsap.timeline({ delay: 0.2, defaults: { ease: "power4.out" } });
    tl.from(".hero .eyebrow", { y: 18, autoAlpha: 0, duration: 0.7 })
      .from(".hero-title .hl", { yPercent: 112, duration: 1.05, stagger: 0.12 }, "-=0.35")
      .from(".hero-sub", { y: 24, autoAlpha: 0, duration: 0.8 }, "-=0.6")
      .from(".hero-meta li", { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, "-=0.5")
      .from(".hero-cta .btn", { y: 22, autoAlpha: 0, stagger: 0.12, duration: 0.7 }, "-=0.55")
      .from(".hero-foot", { autoAlpha: 0, duration: 0.8 }, "-=0.35");
  }

  /* -------------------------------------------------------
     滚动渐入 + 数字滚动
     ------------------------------------------------------- */
  function setupReveals() {
    var els = $$(".reveal");
    if (reduceMotion) { els.forEach(function (el) { el.style.opacity = 1; }); return; }
    gsap.set(els, { autoAlpha: 0, y: 26 });
    ScrollTrigger.batch(els, {
      start: "top 90%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.1, overwrite: true });
      }
    });
  }

  function setupCounters() {
    $$(".stat-num[data-count]").forEach(function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      if (reduceMotion) { el.textContent = target; return; }
      var counter = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: function () {
          gsap.to(counter, {
            val: target,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: function () {
              el.textContent = Math.round(counter.val);
            }
          });
        }
      });
    });
  }

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
      box.innerHTML = '<p style="font-size:12px;color:#8A93A6">二维码生成失败</p>';
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
    requestAnimationFrame(function () {
      $("#shareClose").focus();
    });
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!shareModal.hidden) closeShare();
      if (!lightbox.hidden) closeLightbox();
    }
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
     抽屉与移动端底部栏
     ------------------------------------------------------- */
  var drawer = $("#drawer");
  var scrim = $("#scrim");

  function openDrawer() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.hidden = true;
  }

  $("#menuBtn").addEventListener("click", openDrawer);
  $("#drawerClose").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  $$("#drawer .drawer-nav a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      closeDrawer();
      gsap.to(window, {
        scrollTo: { y: a.getAttribute("href"), offsetY: -76 },
        duration: reduceMotion ? 0 : 0.7,
        ease: "power3.inOut",
        delay: 0.12
      });
    });
  });

  $$("#dock button[data-dock]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.getAttribute("data-dock") === "menu") openDrawer();
      if (btn.getAttribute("data-dock") === "share") openShare();
    });
  });

  /* -------------------------------------------------------
     初始化
     ------------------------------------------------------- */
  buildWheel();
  measureWheel();
  setActive(0);
  renderArchive();
  $("#archiveSearch").addEventListener("input", function () {
    filterArchive(this.value);
  });

  heroIntro();
  setupReveals();
  setupCounters();

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
