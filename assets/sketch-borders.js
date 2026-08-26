/* =========================================================
   手绘铅笔描边：基于 rough.js（GitHub: rough-stuff/rough）
   在卡片上绘制手绘矩形描边，替换 CSS 直线边框
   ========================================================= */
(function () {
  "use strict";

  if (typeof rough === "undefined") return;

  var DARK = "#0B0B0B";
  var LIGHT = "#FFFFFF";

  var groups = [
    { sel: ".page-no", ellipse: true },
    { sel: ".summary-card,.kw-card,.ability-band,.match-card,.star,.ev-shot,.writing-card,.search-box,.arc-item,.profile-card,.hub-item", color: DARK },
    { sel: ".panel,.mini,.stat-card,.honor,.contact-card", color: LIGHT },
    { sel: ".flow-cell", color: DARK, dash: true },
    { sel: ".sb-panel", color: LIGHT, dash: true }
  ];

  var targets = [];

  function collect() {
    targets = [];
    groups.forEach(function (g) {
      Array.prototype.forEach.call(document.querySelectorAll(g.sel), function (el) {
        targets.push({ el: el, color: g.color, dash: !!g.dash });
      });
    });
  }

  function draw() {
    Array.prototype.forEach.call(document.querySelectorAll(".sketch-overlay"), function (s) {
      s.remove();
    });
    collect();
    targets.forEach(function (item, i) {
      var el = item.el;
      var w = el.clientWidth;
      var h = el.clientHeight;
      if (w < 60 || h < 40) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";

      if (item.ellipse) {
        var txt = el.querySelector(".pgnum");
        var pg = txt ? getComputedStyle(txt).stroke : "#FFFFFF";
        var rcE = rough.svg(el);
        // 页码 SVG 固定 viewBox 0 0 500 320，椭圆用 viewBox 坐标
        el.appendChild(rcE.ellipse(250, 162, 285, 195, {
          stroke: pg,
          strokeWidth: 3,
          roughness: 2.2,
          bowing: 1.6,
          seed: 900 + i * 13
        }));
        return;
      }

      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "sketch-overlay");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;";

      var opts = {
        roughness: 1.9,
        bowing: 1.3,
        stroke: item.color,
        strokeWidth: 3.2,
        seed: 1000 + i * 7
      };
      if (item.dash) opts.strokeLineDash = [8, 5];

      var rc = rough.svg(svg);
      // 外扩 4px，让手绘描边落在卡片边缘外侧（白卡黑底时可见）
      svg.appendChild(rc.rectangle(-4, -4, w + 8, h + 8, opts));
      el.appendChild(svg);
    });
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 250);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", draw);
  } else {
    draw();
  }
  window.addEventListener("load", draw);
})();
