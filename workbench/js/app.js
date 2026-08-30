/* 会议纪要智能分析工作台 - 功能层（保留原版布局与 UI，向原容器填充真实数据） */
(function () {
  "use strict";

  const LS = {
    meetings: "mmw_meetings_v1",
    templates: "mmw_templates_v1",
    actions: "mmw_actions_v1",
    comments: "mmw_comments_v1",
    settings: "mmw_settings_v1",
  };

  const state = {
    meetings: [],
    templates: [],
    actions: [],
    comments: {},
    settings: {},
    currentId: null,
    libQuery: "",
    libDept: "",
    actTab: "all",
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);

  /* 首次打开时预置的示例会议（仅写入本机浏览器，可在「设置 → 数据」中清空） */
  const SAMPLE_TEXT = [
    "【产品迭代周会 · 2026-08-22】",
    "",
    "主持人：大家下午好，今天主要同步产品迭代的进度，最后确认下一版的范围。",
    "李想：客户端新版本已经在昨天提交测试了，预计下周三可以发版。",
    "王芳：后台管理端还有一个导出功能没做完，卡在权限接口上，需要后端今天给方案。",
    "张伟：权限接口我来跟进，最晚明天下午给出方案，周五前完成联调。",
    "主持人：那导出功能由王芳负责继续推进，截止时间是下周五。",
    "李想：关于新版首页改版，大家一致同意采用 B 方案，下周一进入开发。",
    "王芳：风险提示一下，改版涉及旧数据迁移，如果下周三之前迁移方案没有确认，上线可能会延迟。",
    "张伟：数据迁移方案由我负责，本周四前给出初稿，周五评审。",
    "主持人：好，那就这么定。运营侧的活动预告这周内发布，由刘洋负责联系设计出图。",
    "刘洋：我这边明天上午跟设计对齐，周三给到初稿，周五上线。",
    "主持人：另外下个月初要做一次客户回访，整理反馈给产品做下一版需求池。",
    "张伟：客户回访名单我来整理，月底前提交。",
    "主持人：最后提醒，明天上午十点前大家把周报发到群里，逾期未交的周五例会通报。",
    "李想：另外我建议把接口文档补充完整，方便新同学快速上手，下周一前更新到知识库。",
    "主持人：这个建议不错，接口文档更新由李想负责，截止下周一。",
    "",
  ].join("\n");

  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function load(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function persist() {
    save(LS.meetings, state.meetings);
    save(LS.templates, state.templates);
    save(LS.actions, state.actions);
    save(LS.comments, state.comments);
    save(LS.settings, state.settings);
    renderNavBadge();
  }

  function toast(msg) {
    const wrap = $("#toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translate(-50%,0)";
      el.style.transition = "opacity .3s ease, transform .3s ease";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%,14px)";
      setTimeout(() => el.remove(), 350);
    }, 2600);
  }

  /* ---------- 数据 ---------- */
  function getMeeting(id) { return state.meetings.find((m) => m.id === id); }

  function parseGlossary() {
    return (state.settings.glossary || []).filter((g) => g.from && g.to);
  }

  function analyzeSource(text, tplId) {
    const tpl = state.templates.find((t) => t.id === tplId) || state.templates[0];
    const analysis = MMEngine.analyze(text, tpl, parseGlossary());
    return { analysis, templateName: tpl.name, templateId: tpl.id };
  }

  function saveMeeting(payload, sourceText) {
    const meeting = Object.assign({
      id: uid(), title: "", date: today(), dept: "", templateName: "例会 / 周会",
      templateId: "tpl-regular", createdAt: Date.now(),
    }, payload);
    meeting.sourceText = sourceText;
    const parsed = MMEngine.parseTranscript(sourceText);
    meeting.segments = parsed.segments;
    meeting.meta = parsed.meta;
    state.meetings.unshift(meeting);
    meeting.analysis.actions.forEach((a) => {
      const key = meeting.id + "::" + a.text;
      if (!state.actions.some((x) => x.key === key)) {
        state.actions.push({ id: uid(), key, meetingId: meeting.id, meetingTitle: meeting.title, text: a.text, owner: a.owner || "", due: a.due || "", status: "todo", createdAt: Date.now() });
      }
    });
    persist();
    return meeting;
  }

  function deleteMeeting(id) {
    state.meetings = state.meetings.filter((m) => m.id !== id);
    state.actions = state.actions.filter((a) => a.meetingId !== id);
    delete state.comments[id];
    if (state.currentId === id) state.currentId = state.meetings[0] ? state.meetings[0].id : null;
    persist();
  }

  function isOverdue(a) {
    if (a.status === "done") return false;
    const m = String(a.due || "").match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})月(\d{1,2})日/);
    if (!m) return false;
    const d = m[1] ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(new Date().getFullYear(), +m[4] - 1, +m[5]);
    return d < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  }

  /* ---------- 页面切换：动画前先渲染内容 ---------- */
  function manualSwitch(id) {
    $$(".page").forEach((p) => p.classList.toggle("on", p.id === "page-" + id));
    $$(".nav-item[data-page]").forEach((n) => n.classList.toggle("active", n.getAttribute("data-page") === id));
    const main = $(".main");
    if (main) main.scrollTop = 0;
  }

  function gotoPage(id) {
    renderPage(id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      manualSwitch(id);
      return;
    }
    const nav = $('.nav-item[data-page="' + id + '"]');
    if (nav && typeof nav.click === "function") nav.click();
    else manualSwitch(id);
  }

  document.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav-item[data-page]");
    if (nav) renderPage(nav.getAttribute("data-page"));
  }, true);

  function renderPage(id) {
    if (id === "dash") renderDash();
    if (id === "library") renderLibrary();
    if (id === "analysis") renderAnalysis();
    if (id === "actions") renderActions();
    if (id === "team") renderTeam();
    if (id === "templates") renderTemplates();
    if (id === "settings") renderSettings();
  }

  function renderNavBadge() {
    const n = state.actions.filter((a) => a.status !== "done").length;
    const b = $("#navBadge");
    if (b) b.textContent = n;
  }

  /* ================= 工作台 ================= */
  function renderDash() {
    const kpi = (id, v, sub) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
      const k = el ? el.closest(".kpi") : null;
      if (k && k.querySelector(".k-sub")) k.querySelector(".k-sub").textContent = sub || "";
    };
    const todo = state.actions.filter((a) => a.status !== "done").length;
    const doneN = state.actions.filter((a) => a.status === "done").length;
    const rate = state.actions.length ? Math.round((doneN / state.actions.length) * 100) : 0;
    kpi("kpiMeetings", state.meetings.length, "全部会议");
    kpi("kpiTodos", todo, "跨会议待办");
    kpi("kpiImports", state.meetings.length, "累计导入会议");
    kpi("kpiRate", rate, "行动项完成率");
    const cross = $("#kpiCross");
    if (cross) cross.textContent = todo;

    const rows = $$(".recent-row");
    state.meetings.slice(0, rows.length).forEach((m, i) => {
      const row = rows[i];
      if (!row) return;
      row.setAttribute("data-mid", m.id);
      const name = $(".r-name", row);
      if (name) {
        name.childNodes[0].textContent = m.title;
        const small = $("small", name);
        if (small) small.textContent = (m.dept || "未分组") + " · " + m.templateName;
      }
      const t = $(".r-type", row); if (t) t.textContent = m.templateName;
      const d = $(".r-date", row); if (d) d.textContent = m.date;
      const a = $(".r-acts", row); if (a) a.textContent = state.actions.filter((x) => x.meetingId === m.id && x.status !== "done").length + " 待办";
    });
    rows.forEach((row, i) => {
      row.onclick = () => { state.currentId = row.getAttribute("data-mid"); gotoPage("analysis"); };
      row.style.display = i < state.meetings.length ? "" : "none";
    });

    const deptMap = {};
    state.meetings.forEach((m) => { deptMap[m.dept || "未分组"] = (deptMap[m.dept || "未分组"] || 0) + 1; });
    const depts = Object.entries(deptMap);
    $$(".dept-tags span").forEach((s, i) => {
      if (i < depts.length) { s.textContent = depts[i][0] + " · " + depts[i][1]; s.style.display = ""; }
      else s.style.display = "none";
    });
    const dn = $(".dept-note");
    if (dn) dn.textContent = "DEPARTMENTS " + depts.length;
    const dp = $(".dept-band p");
    if (dp) dp.textContent = state.meetings.length ? "共 " + state.meetings.length + " 场会议 · " + todo + " 项待办" : "";

    const speakers = {};
    state.meetings.forEach((m) => m.analysis.speakers.forEach((s) => { speakers[s.speaker] = (speakers[s.speaker] || 0) + s.len; }));
    const total = Object.values(speakers).reduce((a, b) => a + b, 0);
    const top = Object.entries(speakers).map(([k, v]) => ({ speaker: k, ratio: total ? Math.round((v / total) * 1000) / 10 : 0 })).sort((a, b) => b.ratio - a.ratio).slice(0, 5);
    const colors = ["#111", "#41413d", "#56524c", "#6d6d68", "#8b8b86"];
    const stack = $(".dash-row .stack");
    if (stack) stack.innerHTML = top.map((s, i) => `<i style="width:${s.ratio}%;background:${colors[i]}"></i>`).join("");
    const lg = $(".dash-row .lg");
    if (lg) lg.innerHTML = top.map((s, i) => `<div class="lg-row"><span class="sw" style="background:${colors[i]}"></span><span class="nm">${esc(s.speaker)}</span><span class="pc">${s.ratio}%</span></div>`).join("");
    const cap = $(".dash-row .dept-caption");
    if (cap) cap.innerHTML = top.length ? "<span>TOP SPEAKERS</span><span>" + state.meetings.length + " MEETINGS</span>" : "";

    $$(".mod-card[data-nav]").forEach((c) => {
      c.onclick = () => gotoPage(c.getAttribute("data-nav"));
    });
  }

  /* ================= 会议记录库 ================= */
  function renderLibrary() {
    const filters = $("#libFilters");
    if (filters) {
      const depts = [...new Set(state.meetings.map((m) => m.dept || "未分组"))];
      const chips = ['<span class="fchip active" data-f="">全部</span>'].concat(depts.map((d) => `<span class="fchip" data-f="${esc(d)}">${esc(d)}</span>`)).join("");
      filters.innerHTML = chips + '<span class="lib-hint">' + state.meetings.length + " 场会议</span>";
      $$(".fchip", filters).forEach((c) => {
        c.onclick = () => {
          $$(".fchip", filters).forEach((x) => x.classList.toggle("active", x === c));
          state.libDept = c.dataset.f;
          drawList();
        };
      });
    }
    const count = $("#libCount");
    if (count) count.textContent = state.meetings.length + " RECORDS";
    const list = $("#libList");
    if (list) list.onclick = (e) => {
      const row = e.target.closest("[data-mid]");
      if (row) { state.currentId = row.getAttribute("data-mid"); gotoPage("analysis"); }
    };
    drawList();

    function drawList() {
      const q = state.libQuery.trim().toLowerCase();
      const items = state.meetings.filter((m) =>
        (!q || m.title.toLowerCase().includes(q) || (m.dept || "").toLowerCase().includes(q) || m.analysis.keywords.some((k) => k.word.includes(q))) &&
        (!state.libDept || (m.dept || "未分组") === state.libDept)
      );
      const list = $("#libList");
      if (!list) return;
      list.innerHTML = items.length ? items.map((m) => `
        <div class="recent-row" data-mid="${m.id}">
          <div class="r-name">${esc(m.title)}<small>${esc(m.dept || "未分组")} · ${esc(m.templateName)} · ${m.analysis.stats.segments} 段 / ${m.analysis.stats.chars} 字</small></div>
          <span class="r-type">${esc(m.templateName)}</span>
          <span class="r-date">${esc(m.date)}</span>
          <span class="r-acts">${state.actions.filter((a) => a.meetingId === m.id && a.status !== "done").length} 待办</span>
          <span class="r-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></span>
        </div>`).join("") : '<div class="empty">暂无匹配的会议，回到工作台导入一份会议记录</div>';
    }
  }

  /* ================= 智能分析（详情） ================= */
  function analysisCards() {
    const map = {};
    $$("#page-analysis .card").forEach((c) => {
      if (c.querySelector(".summary")) map.summary = c;
      else if (c.querySelector(".decision")) map.decisions = c;
      else if (c.querySelector(".action-row")) map.actions = c;
      else if (c.querySelector(".tl")) map.timeline = c;
      else if (c.querySelector(".stack") && !c.querySelector(".heat-row")) map.speakers = c;
      else if (c.querySelector(".heat-row")) map.heat = c;
      else if (c.querySelector(".risk")) map.risks = c;
      else if (c.querySelector(".qa-input")) map.qa = c;
      else if (c.querySelector(".wordcloud")) map.wordcloud = c;
      else if (c.querySelector(".chart")) map.chart = c;
      else if (c.querySelector(".quote")) map.quotes = c;
      else if (c.querySelector(".sop-desc")) map.sop = c;
      else if (c.querySelector(".advice")) map.advice = c;
    });
    return map;
  }

  function renderAnalysis() {
    const m = getMeeting(state.currentId);
    if (!m) return; // 无真实数据时保留原版演示内容
    $$("#page-analysis .grid, #page-analysis .sec").forEach((el) => el.style.display = "");
    const a = m.analysis;
    const crumb = $("#page-analysis .crumb b");
    if (crumb) crumb.textContent = m.title;
    const h1 = $("#page-analysis .head h1");
    if (h1) h1.textContent = m.title;
    const metas = $$("#page-analysis .head .meta span .mono");
    if (metas[0]) metas[0].textContent = m.date;
    if (metas[1]) metas[1].textContent = m.dept || "未分组";
    const meta3 = $("#page-analysis .head .meta span:nth-child(3)");
    if (meta3) meta3.textContent = m.templateName;
    const badges = $$("#page-analysis .head-side .badge");
    if (badges[0]) badges[0].textContent = "AUTO · " + a.stats.segments + " 段";
    if (badges[1]) badges[1].textContent = a.stats.chars + " 字 · " + a.keywords.length + " 关键词";

    const kpis = $$("#page-analysis .kpis .kpi");
    const kdata = [["段落数", a.stats.segments, "段"], ["总字数", a.stats.chars, "字"], ["关键决策", a.stats.decisionCount, "项"], ["行动项", a.stats.actionCount, "项"]];
    kpis.forEach((k, i) => {
      const kd = kdata[i];
      if (!kd) return;
      const num = k.querySelector(".k-num");
      if (num) num.innerHTML = kd[1] + (kd[2] ? `<small>${kd[2]}</small>` : "");
      const sub = k.querySelector(".k-sub");
      if (sub) sub.textContent = kd[0];
      const label = k.querySelector(".k-label");
      if (label) {
        const tn = Array.from(label.childNodes).find((n) => n.nodeType === 3);
        if (tn) tn.textContent = kd[0];
      }
    });

    const tabs = $$("#page-analysis .tabs .tab");
    const tabNames = ["结构化纪要", "行动项", "话题时间线", "风险与问答"];
    tabs.forEach((t, i) => {
      const cnt = t.querySelector(".cnt");
      if (cnt) cnt.textContent = i === 1 ? a.actions.length : i === 2 ? a.timeline.length : i === 3 ? a.risks.length : "";
      t.childNodes[0].textContent = tabNames[i];
      t.onclick = () => {
        tabs.forEach((x) => x.classList.toggle("active", x === t));
        const main = $(".main");
        const secs = $$("#page-analysis .sec");
        if (i === 0) { $$("#page-analysis .grid, #page-analysis .sec").forEach((el) => el.style.display = ""); if (main) main.scrollTop = 0; }
        if (i === 1) { $$("#page-analysis .grid, #page-analysis .sec").forEach((el) => el.style.display = "none"); const grid = $("#page-analysis .grid"); if (grid) grid.style.display = ""; if (main) main.scrollTop = 0; }
        if (i === 2) { $$("#page-analysis .grid, #page-analysis .sec").forEach((el) => el.style.display = "none"); if (secs[0]) { secs[0].style.display = ""; if (main) main.scrollTop = secs[0].offsetTop; } }
        if (i === 3) { $$("#page-analysis .grid, #page-analysis .sec").forEach((el) => el.style.display = "none"); if (secs[1]) { secs[1].style.display = ""; if (main) main.scrollTop = secs[1].offsetTop; } }
      };
    });

    const cards = analysisCards();
    renderSummary(cards.summary, a);
    renderDecisions(cards.decisions, a);
    renderActionRows(cards.actions, m, a);
    renderTimeline(cards.timeline, a);
    renderSpeakers(cards.speakers, a);
    renderHeat(cards.heat, a);
    renderRisks(cards.risks, a);
    renderQA(cards.qa, m);
    renderWordCloud(cards.wordcloud, a);
    renderChart(cards.chart, a);
    renderQuotes(cards.quotes, a);
    renderSOP(cards.sop, cards.advice, m, a);
    const foot = $("#page-analysis .foot");
    if (foot) foot.innerHTML = "<span>MEETING INTELLIGENCE</span><span>" + m.title + " · " + m.date + "</span>";
  }

  function renderSummary(card, a) {
    if (!card) return;
    const top = a.keywords.slice(0, 5).map((k) => k.word);
    let html = esc(a.summary.summary);
    top.forEach((w) => { html = html.split(w).join("<strong>" + w + "</strong>"); });
    card.querySelector(".card-head h3").textContent = "一句话摘要";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = "AUTO · " + a.summary.points.length + " 句";
    card.querySelector(".summary").innerHTML = html;
  }

  function renderDecisions(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "关键决策";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.decisions.length + " 项";
    card.querySelectorAll(".decision").forEach((d) => d.remove());
    if (!a.decisions.length) {
      card.insertAdjacentHTML("beforeend", '<div class="empty">未识别到明确决策，可在原文中核对</div>');
      return;
    }
    a.decisions.forEach((x) => {
      card.insertAdjacentHTML("beforeend", `
        <div class="decision"><div class="check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
        <p><b>${esc(x.text)}</b>${x.speaker !== "未标注" ? `<span class="tag">${esc(x.speaker)}${x.time ? " · " + MMEngine.fmtTime(x.time) : ""}</span>` : ""}</p></div>`);
    });
  }

  function renderActionRows(card, m, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "行动项";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.actions.length + " 项 · 点击状态切换";
    card.querySelectorAll(".action-row").forEach((r) => r.remove());
    if (!a.actions.length) {
      card.insertAdjacentHTML("beforeend", '<div class="empty">未识别到行动项</div>');
      return;
    }
    a.actions.forEach((x) => {
      const synced = state.actions.find((s) => s.meetingId === m.id && s.text === x.text);
      const done = synced && synced.status === "done";
      card.insertAdjacentHTML("beforeend", `
        <div class="action-row" data-aid="${synced ? synced.id : ""}" style="cursor:pointer">
          <div class="action-name">${esc(x.text)}<small>${x.speaker !== "未标注" ? "提出：" + esc(x.speaker) : ""}${x.due ? " · 截止 " + esc(x.due) : ""}</small></div>
          <div class="person"><span class="pavatar">${esc((x.owner || "待").slice(0, 1))}</span>${esc(x.owner || "待指定")}</div>
          <div class="due">${esc(x.due || "—")}</div>
          <div class="st ${done ? "done" : "todo"}">${done ? "DONE" : "TODO"}</div>
        </div>`);
    });
    $$(".action-row", card).forEach((row) => {
      row.onclick = () => {
        const aid = row.getAttribute("data-aid");
        if (!aid) return;
        toggleAction(aid);
        renderAnalysis();
      };
    });
  }

  function renderTimeline(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "讨论话题时间线";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.timeline.length + " 个话题";
    card.querySelectorAll(".tl-item").forEach((r) => r.remove());
    const max = Math.max.apply(null, a.timeline.map((g) => g.count)) || 1;
    a.timeline.forEach((g, i) => {
      card.insertAdjacentHTML("beforeend", `
        <div class="tl-item">
          <div class="row1"><span class="idx">${String(i + 1).padStart(2, "0")}</span><span class="t">${esc(g.topic)}</span><span class="tm">${g.start ? MMEngine.fmtTime(g.start) + " – " + MMEngine.fmtTime(g.end) : "讨论 " + g.count + " 句"}</span></div>
          <div class="tl-bar"><i style="width:${Math.max(8, Math.round((g.count / max) * 100))}%"></i></div>
        </div>`);
    });
  }

  function renderSpeakers(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "发言人发言占比";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.speakers.length + " 人";
    const stack = card.querySelector(".stack");
    const lg = card.querySelector(".lg");
    if (!a.speakers.length) {
      stack.innerHTML = "";
      lg.innerHTML = '<div class="empty">文稿中未标注说话人</div>';
      return;
    }
    const colors = ["#111", "#41413d", "#56524c", "#6d6d68", "#8b8b86", "#9b9b96"];
    stack.innerHTML = a.speakers.slice(0, 6).map((s, i) => `<i style="width:${s.ratio}%;background:${colors[i]}"></i>`).join("");
    lg.innerHTML = a.speakers.slice(0, 6).map((s, i) => `<div class="lg-row"><span class="sw" style="background:${colors[i]}"></span><span class="nm">${esc(s.speaker)}</span><span class="pc">${s.ratio}%</span></div>`).join("");
  }

  function renderHeat(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "议题关注度";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = "TOP 5";
    card.querySelectorAll(".heat-row").forEach((r) => r.remove());
    const rows = a.keywords.slice(0, 5);
    const max = rows.length ? rows[0].count : 1;
    rows.forEach((k) => {
      card.insertAdjacentHTML("beforeend", `<div class="heat-row"><span>${esc(k.word)}</span><div class="heat-bar"><i style="width:${Math.max(8, Math.round((k.count / max) * 100))}%"></i></div><span class="v">×${k.count}</span></div>`);
    });
  }

  function renderRisks(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "风险与遗漏提醒";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.risks.length + " 项";
    card.querySelectorAll(".risk").forEach((r) => r.remove());
    if (!a.risks.length) {
      card.insertAdjacentHTML("beforeend", '<div class="empty">未发现明显风险信号</div>');
      return;
    }
    a.risks.forEach((x, i) => {
      card.insertAdjacentHTML("beforeend", `
        <div class="risk ${i % 2 ? "warn" : ""}">
          <div class="risk-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg></div>
          <div><b>风险 ${i + 1}</b><p>${esc(x.text)}${x.speaker !== "未标注" ? "（" + esc(x.speaker) + "）" : ""}</p></div>
        </div>`);
    });
  }

  function renderQA(card, m) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "AI 智能问答";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = "针对本次会议提问";
    const input = card.querySelector(".qa-input");
    if (!input) return;
    input.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 113.6 1.6 8.38 8.38 0 01-3.6-.9"/></svg><input placeholder="例如：导出功能由谁负责？"><span class="send" style="cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></span>';
    const q = card.querySelector(".qa.q");
    const aEl = card.querySelector(".qa.a");
    if (q) q.style.display = "none";
    if (aEl) aEl.style.display = "none";
    const ask = () => {
      const inp = card.querySelector(".qa-input input");
      const text = inp.value.trim();
      if (!text) return;
      const res = MMEngine.qa(text, m.segments, parseGlossary());
      const lines = res.map((r) => (r.speaker !== "未标注" ? r.speaker + "：" : "") + r.text + (r.time ? " [" + MMEngine.fmtTime(r.time) + "]" : ""));
      const answer = lines.length ? lines : ["没有在本次会议中找到相关内容，换个问法试试。"];
      if (q) { q.style.display = ""; q.textContent = text; }
      if (aEl) {
        aEl.style.display = "";
        aEl.innerHTML = "<b>" + esc(answer[0]) + "</b>" + answer.slice(1).map((x) => '<span class="cite">' + esc(x) + "</span>").join("");
      }
      inp.value = "";
    };
    const send = card.querySelector(".send");
    if (send) send.onclick = ask;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
  }

  function renderWordCloud(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "会议关键词云";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = "TOP " + Math.min(14, a.keywords.length);
    const wc = card.querySelector(".wordcloud");
    const sizes = [26, 22, 19, 17, 15, 14, 13, 12.5, 12, 11.5, 11, 11, 10.5, 10.5];
    const colors = ["#000", "#111", "#262626", "#3c3c38", "#4d4d4a", "#5a5a56", "#6f6f6a", "#6f6f6a", "#7c7c77", "#8e8e89", "#8e8e89", "#9b9b96", "#9b9b96", "#9b9b96"];
    wc.innerHTML = a.keywords.slice(0, 14).map((k, i) => `<span class="wc" style="font-size:${sizes[i]}px;font-weight:${800 - i * 25};color:${colors[i]}">${esc(k.word)}</span>`).join("");
    const tip = card.querySelector(".wc-tip");
    if (tip) tip.textContent = "基于词频自动提取 · 共 " + a.keywords.length + " 个关键词";
  }

  function renderChart(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "议题热度趋势";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = a.timeline.length + " 个话题";
    const chart = card.querySelector(".chart");
    const groups = a.timeline.slice(0, 8);
    const max = Math.max.apply(null, groups.map((g) => g.count)) || 1;
    const W = 360, H = 118, base = 100;
    const step = groups.length > 1 ? (W - 20) / (groups.length - 1) : 0;
    const pts = groups.map((g, i) => [10 + i * step, base - 4 - Math.round((g.count / max) * 74)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    const area = line + " L" + (pts.length ? pts[pts.length - 1][0] : 10) + ",100 L10,100 Z";
    chart.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}">
        <line x1="0" y1="100" x2="${W}" y2="100" stroke="#e5e5e2" stroke-width="1"/>
        ${[0.2, 0.4, 0.6, 0.8].map((f) => `<line x1="${10 + (W - 20) * f}" y1="10" x2="${10 + (W - 20) * f}" y2="100" stroke="#d2d2ce" stroke-width="1" stroke-dasharray="3 3"/>`).join("")}
        ${groups.map((g, i) => `<text x="${pts[i][0]}" y="${H - 6}" text-anchor="middle" font-size="8" fill="#8e8e89" font-family="Menlo,Consolas,monospace">${esc(g.topic.length > 4 ? g.topic.slice(0, 4) : g.topic)}</text>`).join("")}
        <path fill="#ececea" d="${area}"/>
        <path fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${line}"/>
        ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff" stroke="#111" stroke-width="1.6"/>`).join("")}
      </svg>
      <div class="chart-x"><span>话题讨论量趋势（前 ${groups.length} 个话题）</span><span></span></div>`;
    const note = card.querySelector(".chart-note");
    if (note) note.innerHTML = '<span class="legend-line"></span>纵轴为讨论句数 · 最高话题：' + esc(groups[0] ? groups[0].topic : "—");
  }

  function renderQuotes(card, a) {
    if (!card) return;
    card.querySelector(".card-head h3").textContent = "重点语句摘录";
    const hint = card.querySelector(".hint");
    if (hint) hint.textContent = "AUTO";
    card.querySelectorAll(".quote").forEach((r) => r.remove());
    const top = a.keywords.slice(0, 4).map((k) => k.word);
    a.summary.points.forEach((p, i) => {
      let html = esc(p.text);
      top.forEach((w) => { html = html.split(w).join("<strong>" + w + "</strong>"); });
      card.insertAdjacentHTML("beforeend", `
        <div class="quote"><div class="qmark"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 7H6a3 3 0 00-3 3v4a3 3 0 003 3h2v-4H6v-3h4zm11 0h-4a3 3 0 00-3 3v4a3 3 0 003 3h2v-4h-3v-3h4z"/></svg></div>
        <div class="quote-body"><p>${html}</p><div class="qmeta"><span class="name">${p.speaker !== "未标注" ? esc(p.speaker) : "未标注"}</span><span class="tag-chip solid">${String(i + 1).padStart(2, "0")}</span></div></div></div>`);
    });
  }

  function renderSOP(sopCard, adviceCard, m, a) {
    if (!sopCard) return;
    sopCard.querySelector(".card-head h3").textContent = "标准作业流程 · " + m.templateName;
    const hint = sopCard.querySelector(".hint");
    if (hint) hint.textContent = "模板驱动";
    const desc = sopCard.querySelector(".sop-desc");
    if (desc) desc.textContent = "按「" + m.templateName + "」模板生成：" + ((state.templates.find((t) => t.id === m.templateId) || {}).focus || "");
    sopCard.querySelectorAll(".sop-step").forEach((r) => r.remove());
    a.sop.steps.forEach((s) => {
      sopCard.insertAdjacentHTML("beforeend", `
        <div class="sop-step"><div class="step-num">${s.no}</div><div><p>${esc(s.title)}<span class="desc">${esc(s.detail)}</span></p>
        <div class="chips"><span class="chip role">执行</span><span class="chip">记录留痕</span><span class="chip">节点确认</span></div></div></div>`);
    });
    const actions = sopCard.querySelector(".sop-actions");
    if (actions) {
      actions.innerHTML = `
        <button class="btn btn-ghost" data-act="copy">复制纪要</button>
        <button class="btn btn-ghost" data-act="txt">导出 TXT</button>
        <button class="btn btn-solid" data-act="docx"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>导出 DOCX</button>
        <button class="btn btn-ghost" data-act="print">打印 / PDF</button>`;
      $$("[data-act]", actions).forEach((b) => {
        b.onclick = () => {
          const act = b.getAttribute("data-act");
          if (act === "copy") copyReport(m);
          if (act === "txt") exportTxt(m);
          if (act === "docx") exportDocx(m);
          if (act === "print") window.print();
        };
      });
    }
    if (adviceCard) {
      adviceCard.querySelector(".card-head h3").textContent = "工作建议";
      const hint2 = adviceCard.querySelector(".hint");
      if (hint2) hint2.textContent = "AUTO";
      adviceCard.querySelectorAll(".advice").forEach((r) => r.remove());
      const prio = ["高", "中", "低"];
      a.sop.suggestions.forEach((s, i) => {
        adviceCard.insertAdjacentHTML("beforeend", `
          <div class="advice"><span class="prio ${i === 1 ? "mid" : i === 2 ? "low" : ""}">${prio[Math.min(i, 2)]}</span>
          <div><p>${esc(s)}</p><span class="basis"><span class="cite">AUTO-${String(i + 1).padStart(2, "0")}</span> 基于本次分析生成</span></div></div>`);
      });
    }
  }

  /* ================= 行动项追踪 ================= */
  function renderActions() {
    const meta = $("#actMeta");
    if (meta) meta.textContent = state.meetings.length + " 场会议 · " + state.actions.filter((a) => a.status !== "done").length + " 项待办";
    const count = $("#actCount");
    if (count) count.textContent = state.actions.length + " ITEMS";
    const filters = $("#actFilters");
    if (filters) {
      filters.innerHTML = ["all:全部", "todo:待办", "done:已完成", "overdue:已逾期"].map((f) => {
        const [k, label] = f.split(":");
        return `<span class="fchip ${state.actTab === k ? "active" : ""}" data-t="${k}">${label}</span>`;
      }).join("");
      $$(".fchip", filters).forEach((c) => (c.onclick = () => { state.actTab = c.dataset.t; drawList(); }));
    }
    const input = $("#actInput");
    const add = $("#actAdd");
    if (input) input.onkeydown = (e) => { if (e.key === "Enter") addManual(); };
    if (add) add.onclick = addManual;
    drawList();

    function drawList() {
      const list = $("#actList");
      if (!list) return;
      const items = state.actions.filter((a) => {
        if (state.actTab === "todo") return a.status !== "done";
        if (state.actTab === "done") return a.status === "done";
        if (state.actTab === "overdue") return isOverdue(a);
        return true;
      });
      list.innerHTML = items.length ? items.map((a) => `
        <div class="act-row">
          <div class="action-name">${esc(a.text)}<small>${a.owner ? "负责人 " + esc(a.owner) : "负责人待定"}${a.due ? " · 截止 " + esc(a.due) : ""}${isOverdue(a) ? " · 已逾期" : ""}</small></div>
          <div class="person"><span class="pavatar">${esc((a.owner || "待").slice(0, 1))}</span>${esc(a.owner || "待指定")}</div>
          <div class="due">${esc(a.due || "—")}</div>
          <div class="st ${a.status === "done" ? "done" : "todo"}">${a.status === "done" ? "DONE" : "TODO"}</div>
          <button class="act-toggle ${a.status === "done" ? "done" : ""}" data-tid="${a.id}" title="切换状态">${a.status === "done" ? "✓" : ""}</button>
        </div>`).join("") : '<div class="empty">当前分类下没有行动项</div>';
      $$("[data-tid]", list).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleAction(b.dataset.tid); }));
    }

    function addManual() {
      const v = input.value.trim();
      if (!v) return;
      state.actions.push({ id: uid(), key: "", meetingId: "", meetingTitle: "", text: v, owner: "", due: "", status: "todo", createdAt: Date.now() });
      persist();
      input.value = "";
      drawList();
      toast("已添加行动项");
    }
  }

  function toggleAction(id) {
    const a = state.actions.find((x) => x.id === id);
    if (!a) return;
    a.status = a.status === "done" ? "todo" : "done";
    persist();
    const page = $(".page.on");
    if (page && page.id === "page-actions") renderActions();
    if (page && page.id === "page-analysis") renderAnalysis();
  }

  /* ================= 团队协作 ================= */
  function renderTeam() {
    const count = $("#teamCount");
    if (count) count.textContent = state.meetings.length + " MEETINGS";
    const grid = $("#teamGrid");
    if (!grid) return;
    if (!state.meetings.length) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty">先导入并分析一场会议，团队协作入口会出现在这里</div></div>';
      return;
    }
    grid.innerHTML = state.meetings.map((m) => {
      const list = state.comments[m.id] || [];
      return `
        <div class="card" data-mid="${m.id}">
          <div class="card-head"><h3>${esc(m.title)}</h3><span class="hint">${esc(m.date)}</span></div>
          <div class="qa-chat-input"><input placeholder="评论 / 协作（本机保存）"><span class="send" style="cursor:pointer">评论</span></div>
          <div class="chat" style="max-height:180px">${list.slice(-4).reverse().map((c) => `<div class="msg a"><b style="display:block">${esc(c.author)}</b>${esc(c.text)}<span class="cite">${esc(c.time)}</span></div>`).join("") || '<div class="empty" style="padding:14px">暂无评论</div>'}</div>
          <div class="sop-actions">
            <button class="btn btn-ghost" data-share="${m.id}">复制分享文案</button>
            <button class="btn btn-solid" data-open="${m.id}">打开分析</button>
          </div>
        </div>`;
    }).join("");
    grid.querySelectorAll("[data-mid]").forEach((card) => {
      const input = card.querySelector(".qa-chat-input input");
      const send = card.querySelector(".send");
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        state.comments[card.dataset.mid] = state.comments[card.dataset.mid] || [];
        state.comments[card.dataset.mid].push({ author: "我", time: new Date().toLocaleString("zh-CN"), text: v });
        persist();
        renderTeam();
      };
      send.onclick = add;
      input.onkeydown = (e) => { if (e.key === "Enter") add(); };
    });
    grid.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => copyReport(getMeeting(b.dataset.share))));
    grid.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { state.currentId = b.dataset.open; gotoPage("analysis"); }));
  }

  /* ================= 模板管理 ================= */
  function renderTemplates() {
    const active = $("#tmplActive");
    if (active) active.textContent = state.templates.length + " TEMPLATES";
    const grid = $("#tmplGrid");
    if (!grid) return;
    grid.innerHTML = state.templates.map((t, i) => `
      <div class="tmpl-card ${t.id === (state.settings.activeTemplate || "tpl-regular") ? "active" : ""}" data-tid="${t.id}">
        <span class="tmpl-idx">${String(i + 1).padStart(2, "0")}</span>
        <div class="tmpl-body"><b>${esc(t.name)}</b><p>${esc(t.scene)}</p><p>${esc(t.summaryStyle)}</p></div>
        <span class="tmpl-check"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
      </div>`).join("") + `
      <div class="tmpl-card" data-add="1"><span class="tmpl-idx">＋</span><div class="tmpl-body"><b>新增模板</b><p>复制一份模板，自定义场景与分析重点</p></div></div>`;
    grid.querySelectorAll("[data-tid]").forEach((c) => (c.onclick = () => {
      state.settings.activeTemplate = c.dataset.tid;
      persist();
      renderTemplates();
      toast("已切换为「" + ((state.templates.find((t) => t.id === c.dataset.tid) || {}).name || "") + "」");
    }));
    grid.querySelectorAll("[data-add]").forEach((c) => (c.onclick = () => editTemplate(null)));
  }

  function editTemplate(tpl) {
    const t = tpl || { id: "", name: "", scene: "", summaryStyle: "", focus: "", steps: [] };
    const back = document.createElement("div");
    back.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px";
    back.innerHTML = `<div class="card" style="width:560px;max-width:100%;max-height:90vh;overflow:auto">
      <div class="card-head"><h3>${tpl ? "编辑模板" : "新增模板"}</h3><span class="hint">MEETING TEMPLATE</span></div>
      <div class="set-row"><div style="flex:1"><b>模板名称</b></div><div class="ctl"><input id="eName" value="${esc(t.name)}" style="width:200px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12.5px"></div></div>
      <div class="set-row"><div style="flex:1"><b>适用场景</b></div><div class="ctl"><input id="eScene" value="${esc(t.scene)}" style="width:200px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12.5px"></div></div>
      <div class="set-row"><div style="flex:1"><b>摘要风格</b></div><div class="ctl"><input id="eStyle" value="${esc(t.summaryStyle)}" style="width:200px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12.5px"></div></div>
      <div class="set-row"><div style="flex:1"><b>分析重点</b></div><div class="ctl"><input id="eFocus" value="${esc(t.focus)}" style="width:200px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12.5px"></div></div>
      <div class="set-row" style="align-items:flex-start"><div style="flex:1"><b>SOP 步骤</b><p>每行一步</p></div><div class="ctl"><textarea id="eSteps" style="width:240px;height:110px;border:1px solid var(--line-strong);border-radius:4px;padding:8px 10px;font-size:12px;font-family:inherit">${esc((t.steps || []).join("\n"))}</textarea></div></div>
      <div class="sop-actions" style="justify-content:flex-end">
        <button class="btn btn-ghost" data-cancel>取消</button>
        <button class="btn btn-solid" data-ok>保存</button>
      </div>
    </div>`;
    document.body.appendChild(back);
    back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
    back.querySelector("[data-cancel]").onclick = () => back.remove();
    back.querySelector("[data-ok]").onclick = () => {
      const data = {
        name: back.querySelector("#eName").value.trim(),
        scene: back.querySelector("#eScene").value.trim(),
        summaryStyle: back.querySelector("#eStyle").value.trim(),
        focus: back.querySelector("#eFocus").value.trim(),
        steps: back.querySelector("#eSteps").value.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      if (!data.name) return toast("请填写模板名称");
      if (tpl) Object.assign(tpl, data);
      else state.templates.push(Object.assign({ id: uid() }, data));
      persist();
      back.remove();
      renderTemplates();
      toast("模板已保存");
    };
  }

  /* ================= 设置 ================= */
  function renderSettings() {
    const s = state.settings;
    const rows = $$("#page-settings .card .set-row");
    if (!rows.length) return;
    const anim = rows[1] ? rows[1].querySelector("#setAnim") : null;
    if (anim) {
      anim.classList.toggle("on", s.anim !== false);
      anim.onclick = () => {
        s.anim = anim.classList.contains("on") ? false : true;
        anim.classList.toggle("on", s.anim !== false);
        persist();
      };
    }
    const card = rows[0].closest(".card");
    if (card.querySelector(".set-extra")) return;
    const div = document.createElement("div");
    div.className = "set-extra";
    div.innerHTML = `
      <div class="set-row"><div style="flex:1"><b>称呼</b><p>用于工作台问候语</p></div><div class="ctl"><input id="sName2" maxlength="4" style="width:120px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12.5px"></div></div>
      <div class="set-row"><div style="flex:1"><b>转写接口地址</b><p>OpenAI 兼容，用于音视频自动转写（可选）</p></div><div class="ctl"><input id="sEndpoint" style="width:240px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12px"></div></div>
      <div class="set-row"><div style="flex:1"><b>转写模型</b><p>例如 whisper-1</p></div><div class="ctl"><input id="sModel" style="width:180px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12px"></div></div>
      <div class="set-row"><div style="flex:1"><b>API Key</b><p>仅保存在本机浏览器，用于音视频转写请求</p></div><div class="ctl"><input id="sKey" type="password" style="width:240px;height:32px;border:1px solid var(--line-strong);border-radius:4px;padding:0 10px;font-size:12px"></div></div>
      <div class="set-row" style="align-items:flex-start"><div style="flex:1"><b>术语表</b><p>每行一条：原名=规范名</p></div><div class="ctl"><textarea id="sGloss" style="width:260px;height:90px;border:1px solid var(--line-strong);border-radius:4px;padding:8px 10px;font-size:12px;font-family:inherit"></textarea></div></div>
      <div class="set-row"><div style="flex:1"><b>数据</b><p>导出 JSON 备份 / 导入恢复 / 清空本机数据</p></div><div class="ctl" style="display:flex;gap:6px">
        <button class="btn btn-ghost" data-x="export">导出</button>
        <button class="btn btn-ghost" data-x="import">导入</button>
        <button class="btn btn-solid" data-x="clear">清空</button>
        <input type="file" id="sImportFile" accept=".json" hidden>
      </div></div>`;
    card.appendChild(div);
    const fill = () => {
      $("#sName2").value = s.name || "";
      $("#sEndpoint").value = s.endpoint || "https://api.openai.com/v1";
      $("#sModel").value = s.model || "whisper-1";
      $("#sKey").value = s.apiKey || "";
      $("#sGloss").value = (s.glossary || []).map((g) => g.from + "=" + g.to).join("\n");
    };
    fill();
    const saveCfg = () => {
      s.name = $("#sName2").value.trim();
      s.endpoint = $("#sEndpoint").value.trim().replace(/\/+$/, "");
      s.model = $("#sModel").value.trim();
      s.apiKey = $("#sKey").value.trim();
      s.glossary = $("#sGloss").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const p = l.split(/[=＝]/);
        return { from: (p[0] || "").trim(), to: (p[1] || "").trim() };
      });
      persist();
      const g = $("#greetSuffix");
      if (g) g.textContent = s.name ? s.name : "同学";
      const gl = $("#greetLetter");
      if (gl) gl.textContent = (s.name || "Z").slice(0, 1).toUpperCase();
      const al = $("#avatarLetter");
      if (al) al.textContent = (s.name || "Z").slice(0, 1).toUpperCase();
      toast("设置已保存");
    };
    $("#sName2").onchange = saveCfg;
    $("#sEndpoint").onchange = saveCfg;
    $("#sModel").onchange = saveCfg;
    $("#sKey").onchange = saveCfg;
    $("#sGloss").onchange = saveCfg;
    div.querySelector('[data-x="export"]').onclick = () => {
      const blob = new Blob([JSON.stringify({ meetings: state.meetings, actions: state.actions, comments: state.comments, templates: state.templates, settings: state.settings }, null, 2)], { type: "application/json" });
      saveBlob(blob, "会议纪要工作台数据-" + today() + ".json");
    };
    div.querySelector('[data-x="import"]').onclick = () => $("#sImportFile").click();
    $("#sImportFile").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          if (!d.meetings || !Array.isArray(d.meetings)) throw new Error("bad");
          state.meetings = d.meetings; state.actions = d.actions || []; state.comments = d.comments || {}; state.templates = d.templates || state.templates; Object.assign(state.settings, d.settings || {});
          persist(); fill(); renderPage("dash"); toast("数据已导入");
        } catch (err) { toast("数据文件格式不正确"); }
      };
      fr.readAsText(f);
    };
    div.querySelector('[data-x="clear"]').onclick = () => {
      if (!window.confirm("确定清空全部会议、行动项、评论与设置？不可恢复。")) return;
      [LS.meetings, LS.actions, LS.comments, LS.templates, LS.settings].forEach((k) => localStorage.removeItem(k));
      location.reload();
    };
  }

  /* ================= 导入与导出 ================= */
  function bindImport() {
    const fileInput = $("#importFile");
    const drop = $("#importDrop");
    const pick = $("#importPick");
    const btn = $("#importBtn");
    const filesBox = $("#importFiles");
    let pending = [];

    const openPick = (e) => { if (e) e.preventDefault(); fileInput.click(); };
    pick.onclick = openPick;
    drop.addEventListener("click", (e) => { if (!e.target.closest("button")) openPick(e); });
    drop.addEventListener("dragover", (e) => e.preventDefault());
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      handleFiles(Array.from(e.dataTransfer.files || []));
    });
    fileInput.addEventListener("change", () => { handleFiles(Array.from(fileInput.files || [])); fileInput.value = ""; });
    btn.addEventListener("click", () => {
      if (!pending.length) return toast("请先选择或拖入会议文件");
      const text = pending.map((p) => p.text).filter(Boolean).join("\n\n");
      if (!text) return toast(pending.map((p) => p.error).filter(Boolean).join("；") || "没有可分析的文本");
      const { analysis, templateName, templateId } = analyzeSource(text, state.settings.activeTemplate || "tpl-regular");
      const meeting = saveMeeting({
        title: "会议分析 · " + today(), date: today(), dept: "", templateName, templateId, analysis,
      }, text);
      state.currentId = meeting.id;
      pending = [];
      filesBox.innerHTML = "";
      toast("分析完成");
      gotoPage("analysis");
    });
    $$(".topbar .btn-solid, #heroUploadBtn").forEach((b) => (b.onclick = openPick));
    const demoBtn = $("#demoBtn");
    if (demoBtn) demoBtn.onclick = () => {
      const sample = getOrCreateSampleMeeting();
      state.currentId = sample.id;
      gotoPage("analysis");
    };
    const ghost = $("#page-dash .head-side .btn-ghost");
    if (ghost) ghost.onclick = () => {
      if (!state.meetings.length) return toast("暂无会议可导出");
      const lines = state.meetings.map((m) => {
        const r = MMEngine.buildReport(m, m.analysis);
        return [r.title, r.summary, "决策：" + r.decisions.length + " 项 · 行动项：" + r.actions.length + " 项", ""].join("\n");
      });
      saveBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), "全部会议摘要-" + today() + ".txt");
    };
    const search = $(".search input");
    if (search) {
      search.addEventListener("input", () => {
        state.libQuery = search.value;
        renderLibrary();
        if (search.value) gotoPage("library");
      });
    }
    let depth = 0;
    window.addEventListener("dragenter", (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      depth++;
      drop.style.borderColor = "#111";
      drop.style.background = "#fafaf8";
    });
    window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; drop.style.borderColor = ""; drop.style.background = ""; } });
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      drop.style.borderColor = "";
      drop.style.background = "";
      const fs = Array.from(e.dataTransfer.files || []);
      if (fs.length) handleFiles(fs);
    });
    window.addEventListener("dragover", (e) => e.preventDefault());

    function handleFiles(files) {
      pending = files.map((f) => ({ name: f.name, size: f.size, text: "", error: "" }));
      filesBox.innerHTML = pending.map((p) => `
        <div class="file-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-400);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
        <span class="f-name">${esc(p.name)}</span><span class="f-meta">${fmtSize(p.size)} · 解析中…</span><span class="f-state">待导入</span></div>`).join("");
      Promise.all(files.map((f, i) => parseFile(f).then((r) => { pending[i] = Object.assign(pending[i], r); return r; }))).then((results) => {
        filesBox.innerHTML = results.map((r) => `
          <div class="file-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-400);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
          <span class="f-name">${esc(r.name)}</span><span class="f-meta">${r.error ? "处理失败" : (r.text || "").length + " 字"}</span><span class="f-state">${r.error ? "失败" : "已就绪"}</span></div>`).join("");
        const meta = $("#importMeta");
        if (meta) meta.textContent = results.filter((r) => !r.error).length + " 个文件就绪 · " + (results.filter((r) => r.error).map((r) => r.name + "：" + r.error).join("；") || "可一键分析");
      });
    }

    function parseFile(f) {
      const name = f.name;
      if (/\.(txt|md|srt|vtt)$/i.test(name)) return f.text().then((t) => ({ text: t }));
      if (/\.docx$/i.test(name)) {
        if (!window.mammoth) return Promise.resolve({ error: "DOCX 解析库未加载" });
        return f.arrayBuffer().then((buf) => window.mammoth.extractRawText({ arrayBuffer: buf }).then((r) => ({ text: r.value })));
      }
      if (f.type.startsWith("audio/") || f.type.startsWith("video/")) return transcribe(f);
      return Promise.resolve({ error: "不支持该格式（PDF 请先转换为文本）" });
    }

    function transcribe(f) {
      const s = state.settings;
      if (!s.apiKey || !s.endpoint) return Promise.resolve({ error: "未配置转写接口，请到设置填写 API Key" });
      const fd = new FormData();
      fd.append("file", f);
      fd.append("model", s.model || "whisper-1");
      fd.append("language", "zh");
      return fetch(s.endpoint + "/audio/transcriptions", {
        method: "POST", headers: { Authorization: "Bearer " + s.apiKey }, body: fd,
      }).then((resp) => resp.json().then((j) => ({ resp, j })))
        .then(({ resp, j }) => resp.ok ? { text: j.text || "" } : { error: "转写失败：" + ((j.error && j.error.message) || resp.status) })
        .catch((err) => ({ error: "转写请求失败：" + err.message }));
    }
  }

  function bindSidebarShell() {
    const app = $(".app");
    const sidebar = $("#workbenchSidebar");
    const toggle = $("#sidebarToggle");
    const overlay = $("#sidebarOverlay");
    if (!app || !sidebar || !toggle || !overlay) return;

    const mobile = () => window.matchMedia("(max-width:760px)").matches;
    const setMobileOpen = (open) => {
      sidebar.classList.toggle("open", open);
      overlay.classList.toggle("on", open);
      sidebar.setAttribute("aria-hidden", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "关闭导航栏" : "打开导航栏");
    };
    const setDesktopCollapsed = (collapsed) => {
      app.classList.toggle("sidebar-collapsed", collapsed);
      sidebar.setAttribute("aria-hidden", collapsed ? "true" : "false");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", collapsed ? "展开导航栏" : "收起导航栏");
      try { localStorage.setItem("mmw_sidebar_collapsed_v1", collapsed ? "1" : "0"); } catch (e) {}
    };

    if (!mobile()) {
      let collapsed = false;
      try { collapsed = localStorage.getItem("mmw_sidebar_collapsed_v1") === "1"; } catch (e) {}
      setDesktopCollapsed(collapsed);
    } else {
      setMobileOpen(false);
    }

    toggle.addEventListener("click", () => {
      if (mobile()) setMobileOpen(!sidebar.classList.contains("open"));
      else setDesktopCollapsed(!app.classList.contains("sidebar-collapsed"));
    });
    overlay.addEventListener("click", () => setMobileOpen(false));
    $$(".nav-item[data-page]", sidebar).forEach((item) => item.addEventListener("click", () => {
      if (mobile()) setMobileOpen(false);
    }));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobile() && sidebar.classList.contains("open")) {
        setMobileOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (mobile()) setMobileOpen(false);
      else {
        sidebar.classList.remove("open");
        overlay.classList.remove("on");
        setDesktopCollapsed(app.classList.contains("sidebar-collapsed"));
      }
    });
  }

  function fmtSize(n) {
    if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n > 1024) return (n / 1024).toFixed(1) + " KB";
    return n + " B";
  }

  function copyText(text) {
    const done = () => toast("已复制到剪贴板");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败"); }
    ta.remove();
  }
  function copyReport(m) {
    if (!m) return;
    const a = m.analysis;
    const lines = [
      "【会议纪要】" + m.title, "日期：" + m.date + " · 部门：" + (m.dept || "未分组"),
      "", "一句话摘要：" + a.summary.summary,
      "", "关键决策：", ...a.decisions.map((d, i) => (i + 1) + ". " + d.text),
      "", "行动项：", ...(a.actions.length ? a.actions.map((x, i) => (i + 1) + ". " + x.text + (x.owner ? "（" + x.owner + "）" : "") + (x.due ? " 截止：" + x.due : "")) : ["无"]),
    ];
    copyText(lines.join("\n"));
  }

  function exportTxt(m) {
    const r = MMEngine.buildReport(m, m.analysis);
    const lines = [
      r.title, "日期：" + r.date + " · 部门：" + r.dept + " · 模板：" + r.template, "",
      "【一句话摘要】" + r.summary, "",
      "【关键决策】", ...r.decisions.map((d, i) => (i + 1) + ". " + d.text), "",
      "【行动项】", ...r.actions.map((a, i) => (i + 1) + ". " + a.text + (a.owner ? "　负责人：" + a.owner : "") + (a.due ? "　截止：" + a.due : "")), "",
      "【风险与遗漏】", ...(r.risks.length ? r.risks.map((x, i) => (i + 1) + ". " + x.text) : ["无"]), "",
      "【SOP 建议】", ...r.sop.suggestions.map((s) => "- " + s), "",
      "由会议纪要智能分析工作台生成",
    ];
    saveBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), m.title + ".txt");
    toast("TXT 已导出");
  }

  function exportDocx(m) {
    if (!window.docx) return toast("DOCX 库加载失败");
    toast("正在生成 DOCX…");
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    const r = MMEngine.buildReport(m, m.analysis);
    const font = { ascii: "Microsoft YaHei", eastAsia: "微软雅黑" };
    const t = (text, opt) => new TextRun(Object.assign({ text, font, size: 21 }, opt || {}));
    const h = (text, lv) => new Paragraph({ heading: lv, spacing: { before: 240, after: 120 }, children: [t(text, { size: lv === HeadingLevel.HEADING_1 ? 28 : 24, bold: true, color: "111111" })] });
    const b = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [t(text)] });
    const children = [
      h(r.title, HeadingLevel.HEADING_1),
      new Paragraph({ children: [t("日期：" + r.date + "　部门：" + r.dept + "　模板：" + r.template, { size: 18, color: "6F6F6A" })], spacing: { after: 200 } }),
      h("一句话摘要", HeadingLevel.HEADING_2),
      new Paragraph({ children: [t(r.summary)], spacing: { after: 120 } }),
      h("关键决策", HeadingLevel.HEADING_2),
      ...r.decisions.map((d) => b(d.text)),
      h("行动项", HeadingLevel.HEADING_2),
      ...r.actions.map((a) => b(a.text + (a.owner ? "　负责人：" + a.owner : "") + (a.due ? "　截止：" + a.due : ""))),
      h("风险与遗漏提醒", HeadingLevel.HEADING_2),
      ...(r.risks.length ? r.risks.map((x) => b(x.text)) : [b("未发现明显风险信号")]),
      h("讨论话题时间线", HeadingLevel.HEADING_2),
      ...r.timeline.map((g) => b(g.topic + (g.start ? "（" + MMEngine.fmtTime(g.start) + " – " + MMEngine.fmtTime(g.end) + "）" : ""))),
      h("SOP 与工作建议", HeadingLevel.HEADING_2),
      ...r.sop.suggestions.map((s) => b(s)),
      new Paragraph({ children: [t("—— 由会议纪要智能分析工作台生成", { size: 18, color: "8E8E89" })], spacing: { before: 240 } }),
    ];
    const doc = new Document({ styles: { default: { document: { run: { font } } } }, sections: [{ children }] });
    Packer.toBlob(doc).then((blob) => { saveBlob(blob, m.title + ".docx"); toast("DOCX 已导出"); }).catch(() => toast("导出失败"));
  }

  function saveBlob(blob, name) {
    name = String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  /* ================= 初始化 ================= */
  function seedSample() {
    const { analysis, templateName, templateId } = analyzeSource(SAMPLE_TEXT, "tpl-regular");
    return saveMeeting({
      title: "示例：产品迭代周会",
      date: today(),
      dept: "产品 / 研发",
      templateName,
      templateId,
      analysis,
      isSample: true,
    }, SAMPLE_TEXT);
  }

  function getOrCreateSampleMeeting() {
    const sample = state.meetings.find((m) => m.isSample || m.title === "示例：产品迭代周会");
    if (sample) {
      if (!sample.isSample) { sample.isSample = true; persist(); }
      return sample;
    }
    return seedSample();
  }

  function init() {
    state.templates = load(LS.templates, null) || MMEngine.defaultTemplates();
    if (!load(LS.templates, null)) save(LS.templates, state.templates);
    state.meetings = load(LS.meetings, []);
    state.actions = load(LS.actions, []);
    state.comments = load(LS.comments, {});
    state.settings = load(LS.settings, {});
    const s = state.settings;
    const g = $("#greetSuffix");
    if (g) g.textContent = s.name ? s.name : "同学";
    const gl = $("#greetLetter");
    if (gl) gl.textContent = (s.name || "Z").slice(0, 1).toUpperCase();
    const al = $("#avatarLetter");
    if (al) al.textContent = (s.name || "Z").slice(0, 1).toUpperCase();
    bindImport();
    bindSidebarShell();
    renderNavBadge();
    if (state.meetings.length) {
      state.currentId = state.meetings[0].id;
      renderPage("dash");
    } else {
      state.currentId = seedSample().id;
      renderPage("dash");
    }
    document.body.dataset.boot = "ok";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
