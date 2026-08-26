/* 会议纪要分析引擎：纯函数，无 DOM 依赖 */
(function (global) {
  "use strict";

  const STOP = new Set(("的 了 是 在 我 你 他 她 它 我们 你们 他们 咱们 这个 那个 一个 一下 什么 怎么 为什么 可以 需要 应该 已经 没有 就是 还是 但是 因为 所以 如果 虽然 然后 而且 并且 或者 其实 觉得 认为 非常 比较 特别 一定 可能 大概 今天 明天 这个 那个 大家 各位 咱们 一下 一点 一些 这样 那样 这些 那些 这里 那里 现在 刚才 然后 还有 以及 关于 对于 通过 进行 完成 我们 你们 他们 目前 之前 之后 时候 事情 问题 情况 工作 项目 会议 内容 相关 进行 已经 需要 可以 应该 是否 是否 什么 怎么 为什么 时间 部门 负责 安排 沟通 讨论 意见 建议 确认 结果 方案 计划 进度 完成 处理 解决 支持 帮助 希望 要求 具体 主要 重点 包括 提供 使用 实现 上线 客户 用户 团队 小组 数据 系统 平台 功能 版本 产品 业务 流程 文件 材料 信息 邮件 电话 群里 微信 明天 下周 本周 月底 尽快 后续 前面 刚才 其他 可能 应该 需要 必须 可以 会去 去做 一下 这块 这块 这块".split(/\s+/)));

  function clean(t) {
    return String(t || "").replace(/\r/g, "").replace(/\uFEFF/g, "").trim();
  }

  /* ---------- 文稿解析 ---------- */
  function parseTranscript(raw) {
    const text = clean(raw);
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const segments = [];
    let mode = "plain";
    if (/^\s*\d{1,3}\s*$/.test(lines[0]) && /-->/.test(lines[1] || "")) mode = "srt";
    if (/^WEBVTT/i.test(lines[0])) mode = "vtt";

    if (mode === "srt" || mode === "vtt") {
      let i = 0;
      while (i < lines.length) {
        let time = "";
        if (mode === "srt" && /^\d{1,3}\s*$/.test(lines[i])) i++;
        const tl = lines[i] || "";
        const tm = tl.match(/(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/);
        if (!tm) { i++; continue; }
        time = normTime(tm[1]);
        i++;
        const buf = [];
        while (i < lines.length && !/-->/.test(lines[i]) && !/^\d{1,3}\s*$/.test(lines[i]) && !/^WEBVTT/i.test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        const body = buf.join(" ").replace(/<[^>]+>/g, "").trim();
        if (body) {
          const sp = parseSpeaker(body);
          segments.push({ speaker: sp.speaker, time, text: sp.text, raw: body });
        }
      }
    } else {
      // 逐行：优先识别“说话人：内容”，无标记则归为“未标注”
      let cur = null;
      for (const ln of lines) {
        if (/^[A-Za-z0-9\u4e00-\u9fa5·（）() ]{1,16}[：:]\s*\S/.test(ln) && !/^\d{1,2}[:：]\d{2}/.test(ln)) {
          if (cur) segments.push(cur);
          const sp = parseSpeaker(ln);
          cur = { speaker: sp.speaker, time: "", text: sp.text, raw: ln };
        } else if (cur) {
          cur.text += " " + ln;
          cur.raw += "\n" + ln;
        } else {
          const sp = parseSpeaker(ln);
          cur = { speaker: sp.speaker, time: "", text: sp.text, raw: ln };
        }
      }
      if (cur) segments.push(cur);
    }
    const meta = {
      hasTime: segments.some((s) => !!s.time),
      hasSpeaker: segments.some((s) => s.speaker !== "未标注"),
      count: segments.length,
    };
    return { segments, meta, mode };
  }

  function normTime(t) {
    const parts = t.replace(",", ".").split(":");
    let sec = parseFloat(parts.pop());
    let min = parseInt(parts.pop() || "0", 10);
    let hr = parseInt(parts.pop() || "0", 10);
    return hr * 3600 + min * 60 + sec;
  }

  function fmtTime(sec) {
    if (sec === "" || sec == null || isNaN(sec)) return "";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return (h ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  function parseSpeaker(line) {
    let m = line.match(/^\[([^\]]{1,16})\]\s*(.+)$/);
    if (m) return { speaker: m[1].trim(), text: m[2].trim() };
    m = line.match(/^([\u4e00-\u9fa5A-Za-z0-9·（）() ]{1,16})[：:]\s*(.+)$/);
    if (m) return { speaker: m[1].trim(), text: m[2].trim() };
    return { speaker: "未标注", text: line.trim() };
  }

  /* ---------- 句子切分 ---------- */
  function splitSentences(text) {
    const out = [];
    const parts = String(text || "").split(/(?<=[。！？!?；;\n])/);
    for (const p of parts) {
      const s = p.trim();
      if (s) out.push(s);
    }
    return out;
  }

  /* ---------- 关键词提取 ---------- */
  function topKeywords(text, n) {
    n = n || 30;
    const counts = new Map();
    const cjk = String(text || "").match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    for (const g of cjk) {
      for (let size = 2; size <= 3 && size <= g.length; size++) {
        for (let i = 0; i + size <= g.length; i++) {
          const w = g.slice(i, i + size);
          if (STOP.has(w) || STOP.has(w[0]) || STOP.has(w[1])) continue;
          counts.set(w, (counts.get(w) || 0) + 1);
        }
      }
    }
    const latin = String(text || "").match(/[A-Za-z][A-Za-z0-9._-]{1,}/g) || [];
    for (const w of latin) {
      const lw = w.toLowerCase();
      if (STOP.has(lw)) continue;
      counts.set(lw, (counts.get(lw) || 0) + 1);
    }
    const arr = [...counts.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
    const top = arr.slice(0, n * 2);
    // 去掉被更长热词覆盖的短词
    const final = [];
    for (const item of top) {
      const covered = final.some((f) => f.word.includes(item.word) && f.count >= item.count);
      if (!covered) final.push(item);
      if (final.length >= n) break;
    }
    return final;
  }

  /* ---------- 摘要 ---------- */
  function summarize(segments, n) {
    n = n || 3;
    const kws = topKeywords(segments.map((s) => s.text).join(" "), 20);
    const kwSet = new Map(kws.map((k, i) => [k.word, k.count]));
    const sents = [];
    segments.forEach((seg, si) => {
      splitSentences(seg.text).forEach((s) => sents.push({ s, speaker: seg.speaker, time: seg.time, si }));
    });
    const scored = sents.map((item, idx) => {
      let score = 0;
      for (const [w, c] of kwSet) {
        let hits = 0;
        let from = 0;
        while (true) {
          const p = item.s.indexOf(w, from);
          if (p < 0) break;
          hits++; from = p + w.length;
        }
        if (hits) score += hits * Math.min(c, 3);
      }
      if (/结论|决定|确认|重点|建议|总结|达成|一致|方案|下一步/.test(item.s)) score += 2;
      if (idx < 2 || idx > sents.length - 3) score += 1.2;
      if (item.s.length < 8 || item.s.length > 90) score *= 0.6;
      return { ...item, score };
    }).sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, n).sort((a, b) => a.si - b.si);
    return {
      summary: picked.map((p) => p.s).join("；"),
      points: picked.map((p) => ({ text: p.s, speaker: p.speaker, time: p.time })),
    };
  }

  /* ---------- 决策 / 行动项 / 风险 ---------- */
  function detectDecisions(segments) {
    const out = [];
    const RE = /决定|确认|敲定|拍板|商定|达成一致|一致同意|表决|通过|确定了|确定为|最终选择|批准/;
    for (const seg of segments) {
      for (const s of splitSentences(seg.text)) {
        if (RE.test(s) && s.length >= 6 && s.length <= 90 && !out.some((d) => d.text === s)) {
          out.push({ text: s, speaker: seg.speaker, time: seg.time });
          if (out.length >= 6) return out;
        }
      }
    }
    return out;
  }

  function detectActions(segments) {
    const out = [];
    const RE = /负责|跟进|落实|推进|完成|输出|提交|交付|准备|安排|联系|对接|整理|汇总|统计|撰写|发布|上线|截止|deadline|DDL|下周|本周|明天|月底|下月|尽快|待办|行动项/;
    const ownerRe = /(?:由|请|让|交给|安排)\s*([\u4e00-\u9fa5A-Za-z·]{1,4})\s*(?:负责|跟进|落实|完成|推进|确认|整理|提交)/;
    const dueRe = /(?:截止(?:时间|日期)?|deadline|DDL|ddl)\s*(?:是|为|定于)?\s*[:：]?\s*([^，。；,\s]{1,14})|(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}月\d{1,2}日)|(周[一二三四五六日])|(下周|明天|今天|月底|下月|本月底|本周内)/;
    for (const seg of segments) {
      for (const s of splitSentences(seg.text)) {
        if (RE.test(s) && s.length >= 6 && s.length <= 110 && !out.some((a) => a.text === s)) {
          let owner = "";
          let due = "";
          const om = s.match(ownerRe);
          if (om && om[1] !== "我们" && om[1] !== "大家") {
            owner = om[1];
            if ((owner === "我" || owner === "本人" || owner === "自己") && seg.speaker !== "未标注") owner = seg.speaker;
          }
          const dm = s.match(dueRe);
          if (dm) due = dm[1] || dm[2] || dm[3] || dm[4] || dm[5] || "";
          out.push({ text: s, owner, due, speaker: seg.speaker, time: seg.time });
          if (out.length >= 12) return out;
        }
      }
    }
    return out;
  }

  function detectRisks(segments) {
    const out = [];
    const RE = /风险|逾期|延迟|滞后|未决|待确认|不确定|卡住|阻塞|缺人|缺资源|没人负责|未完成|没做完|遗漏|超时|冲突|隐患|来不及|比较急|有难度|有问题/;
    for (const seg of segments) {
      for (const s of splitSentences(seg.text)) {
        if (RE.test(s) && s.length >= 6 && s.length <= 90 && !out.some((r) => r.text === s)) {
          out.push({ text: s, speaker: seg.speaker, time: seg.time });
          if (out.length >= 6) return out;
        }
      }
    }
    return out;
  }

  /* ---------- 时间线 ---------- */
  function buildTimeline(segments) {
    const kws = topKeywords(segments.map((s) => s.text).join(" "), 15);
    const kwWords = kws.slice(0, 6).map((k) => k.word);
    const groups = [];
    let cur = null;
    for (const seg of segments) {
      const topic = kwWords.find((w) => seg.text.includes(w)) || (cur ? cur.topic : "开场与讨论");
      if (!cur || (topic !== cur.topic && groups.length < 8)) {
        if (cur) groups.push(cur);
        cur = { topic, items: [], start: seg.time || "", end: seg.time || "" };
      }
      cur.items.push(seg);
      if (seg.time) cur.end = seg.time;
    }
    if (cur) groups.push(cur);
    return groups.map((g) => ({
      topic: g.topic,
      start: g.start,
      end: g.end,
      count: g.items.length,
      lines: g.items.slice(0, 3).map((s) => ({ speaker: s.speaker, text: s.text.slice(0, 60), time: s.time })),
    }));
  }

  /* ---------- 发言占比 ---------- */
  function speakerStats(segments) {
    const map = new Map();
    let total = 0;
    for (const s of segments) {
      if (s.speaker === "未标注") continue;
      map.set(s.speaker, (map.get(s.speaker) || 0) + s.text.length);
      total += s.text.length;
    }
    if (!total) return [];
    return [...map.entries()]
      .map(([speaker, len]) => ({ speaker, len, ratio: Math.round((len / total) * 1000) / 10 }))
      .sort((a, b) => b.len - a.len);
  }

  /* ---------- 智能问答 ---------- */
  function qa(question, segments, glossary) {
    const q = clean(question);
    if (!q) return [];
    const terms = [];
    const cjk = q.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    for (const g of cjk) {
      for (let size = 2; size <= 3 && size <= g.length; size++) {
        for (let i = 0; i + size <= g.length; i++) {
          const w = g.slice(i, i + size);
          if (!STOP.has(w)) terms.push(w);
        }
      }
    }
    const latin = q.match(/[A-Za-z][A-Za-z0-9._-]{1,}/g) || [];
    terms.push(...latin.map((w) => w.toLowerCase()));
    const gloss = {};
    (glossary || []).forEach((g) => { if (g.from && g.to) gloss[g.from] = g.to; });
    const scored = [];
    segments.forEach((seg) => {
      const norm = normalizeForMatch(seg.text, gloss);
      splitSentences(seg.text).forEach((s) => {
        const sn = normalizeForMatch(s, gloss);
        let score = 0;
        for (const t of terms) if (sn.includes(t) || norm.includes(t)) score += 1 + t.length / 10;
        if (score > 0) scored.push({ text: s, speaker: seg.speaker, time: seg.time, score });
      });
    });
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    return scored.filter((s) => !seen.has(s.text) && seen.add(s.text)).slice(0, 3);
  }

  function normalizeForMatch(t, gloss) {
    let s = t;
    for (const [k, v] of Object.entries(gloss)) s = s.split(k).join(v);
    return s;
  }

  /* ---------- 模板 / SOP ---------- */
  function defaultTemplates() {
    return [
      {
        id: "tpl-regular",
        name: "例会 / 周会",
        scene: "部门例会、周会、项目例会",
        summaryStyle: "极简：一句话摘要 + 3 条重点",
        focus: "进展同步、阻塞问题、下一步行动",
        steps: ["会前同步议程", "逐项同步进展与问题", "明确每项行动的责任人与截止时间", "会后归档纪要并同步缺席人员"],
      },
      {
        id: "tpl-decision",
        name: "决策会",
        scene: "方案评审、需求评审、立项决策",
        summaryStyle: "结论先行：决策 + 理由 + 影响范围",
        focus: "决策事项、备选方案、表决结论、负责人",
        steps: ["明确待决策事项与背景", "记录备选方案与利弊", "固化决策结论与适用条件", "拆解落地行动项并指定负责人"],
      },
      {
        id: "tpl-client",
        name: "客户会",
        scene: "客户沟通、需求对齐、项目验收",
        summaryStyle: "对外友好：共识 + 承诺 + 时间节点",
        focus: "客户诉求、双方承诺、验收标准",
        steps: ["记录客户核心诉求", "明确双方承诺事项", "固化交付节点与验收标准", "会后向客户发送确认纪要"],
      },
      {
        id: "tpl-review",
        name: "复盘会",
        scene: "项目复盘、事故复盘、季度复盘",
        summaryStyle: "结构化：结果 - 原因 - 改进",
        focus: "目标与结果差距、根因、改进动作",
        steps: ["对齐目标与结果数据", "按流程还原关键节点", "定位根因并区分内外部因素", "形成可追踪的改进动作"],
      },
    ];
  }

  function generateSOP(template, analysis) {
    const steps = (template.steps || defaultTemplates()[0].steps).map((title, i) => ({
      no: i + 1,
      title,
      detail: detailForStep(i, template, analysis),
    }));
    const suggestions = [];
    if (analysis.actions.length) {
      suggestions.push(`本次识别出 ${analysis.actions.length} 条行动项：请按截止时间排序，优先跟进 ${analysis.actions[0].text.slice(0, 24)}。`);
    }
    if (analysis.decisions.length) {
      suggestions.push(`已将 ${analysis.decisions.length} 项关键决策纳入纪要，建议在会后 24 小时内同步给未参会人员。`);
    }
    if (analysis.risks.length) {
      suggestions.push(`检测到 ${analysis.risks.length} 处风险信号：${analysis.risks[0].text.slice(0, 24)}，建议尽快明确责任人与应对措施。`);
    }
    if (!analysis.risks.length && !analysis.actions.length) {
      suggestions.push("本次会议未发现明确的行动项或风险信号，建议核对转写文稿是否完整。");
    }
    return { steps, suggestions };
  }

  function detailForStep(i, template, analysis) {
    const byIdx = [
      `按模板「${template.name}」准备议程，明确本场会议要产出的结论与行动项。`,
      `确保录音/文稿完整，转写后进行错别字与说话人标注校对。`,
      `自动提取摘要、决策、行动项与风险；人工只需复核，不重复整理。`,
      `将行动项按「负责人 + 截止时间」下发，并在下一次会议前逐项核对。`,
      `归档纪要、SOP 与行动项看板，沉淀为部门可复用知识。`,
    ];
    return byIdx[Math.min(i, byIdx.length - 1)];
  }

  /* ---------- 汇总分析 ---------- */
  function analyze(text, template, glossary) {
    const { segments, meta } = parseTranscript(text);
    const kws = topKeywords(segments.map((s) => s.text).join(" "), 30);
    const summary = summarize(segments, 3);
    const decisions = detectDecisions(segments);
    const actions = detectActions(segments);
    const risks = detectRisks(segments);
    const timeline = buildTimeline(segments);
    const speakers = speakerStats(segments);
    const sop = generateSOP(template, { decisions, actions, risks });
    return {
      meta,
      keywords: kws,
      summary,
      decisions,
      actions,
      risks,
      timeline,
      speakers,
      sop,
      glossTerms: glossary,
      stats: {
        segments: segments.length,
        chars: segments.reduce((n, s) => n + s.text.length, 0),
        decisionCount: decisions.length,
        actionCount: actions.length,
        riskCount: risks.length,
        speakerCount: new Set(segments.map((s) => s.speaker)).size,
      },
    };
  }

  function buildReport(meeting, analysis) {
    return {
      title: meeting.title,
      date: meeting.date,
      dept: meeting.dept,
      template: meeting.templateName,
      summary: analysis.summary.summary,
      keywords: analysis.keywords.slice(0, 10).map((k) => k.word),
      decisions: analysis.decisions,
      actions: analysis.actions,
      risks: analysis.risks,
      timeline: analysis.timeline,
      speakers: analysis.speakers,
      sop: analysis.sop,
      stats: analysis.stats,
    };
  }

  const Engine = {
    clean,
    parseTranscript,
    splitSentences,
    topKeywords,
    summarize,
    detectDecisions,
    detectActions,
    detectRisks,
    buildTimeline,
    speakerStats,
    qa,
    analyze,
    buildReport,
    defaultTemplates,
    fmtTime,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else global.MMEngine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
