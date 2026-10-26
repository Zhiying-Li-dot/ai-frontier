/** Keyword navigation over the public snapshot; not a quality or popularity ranking. */
export type Material = { id: string; title: string; originalTitle?: string; tags?: string[]; sourceUrl: string; publishedAt: string };
const DAY = 86400000;
const SHANGHAI_OFFSET = 8 * 3600000;
export const topics = [
  { id: 'agents', label: 'Agent 与工具', color: '#93d7c6', pattern: /\bagents?\b|\btools?\b|\bagentic\b|智能体|工具调用/i },
  { id: 'security', label: '安全与攻防', color: '#f3b4a3', pattern: /\bsecur\w*\b|\bsafety\b|\battack\w*\b|\bjailbreak\w*\b|\binjection\b|\bprivacy\b|安全|攻击|越狱|注入|隐私/i },
  { id: 'evaluation', label: '评测与对齐', color: '#c8bdf3', pattern: /\bevaluat\w*\b|\bbenchmark\w*\b|\balign\w*\b|\breward\b|\brlhf\b|评测|评估|对齐|奖励/i },
  { id: 'reasoning', label: '推理与效率', color: '#b6d4fb', pattern: /\breason\w*\b|\binference\b|\befficien\w*\b|\bdiffusion\b|\bmathemat\w*\b|推理|效率|数学|扩散/i },
  { id: 'multimodal', label: '多模态与世界', color: '#efcf8b', pattern: /\bmultimodal\b|\bvision\b|\bvisual\b|\bvideo\b|\bworld models?\b|\brobot\w*\b|多模态|视觉|视频|世界模型|机器人/i },
  { id: 'memory', label: '记忆与知识', color: '#a5cee0', pattern: /\bmemor\w*\b|\bcontext\b|\bretriev\w*\b|\brag\b|\bknowledge\b|记忆|上下文|检索|知识/i },
  { id: 'other', label: '其他研究', color: '#c5cbc8', pattern: null },
];
export function matchesTopic(item: Material, topic: string): boolean {
  if (topic === 'all') return true;
  const text = [item.title, item.originalTitle || '', ...(item.tags || [])].join(' ');
  const matched = topics.filter(t => t.pattern?.test(text));
  return topic === 'other' ? !matched.length : matched.some(t => t.id === topic);
}
export function withinWindow(item: Material, days: number, now: number): boolean {
  if (!days) return true;
  const time = Date.parse(item.publishedAt);
  return Number.isFinite(time) && time <= now && time >= now - days * DAY;
}
function sourceKey(item: Material): string {
  try {
    const u = new URL(item.sourceUrl);
    if (/^(?:export\.)?arxiv\.org$/i.test(u.hostname)) {
      return 'arxiv:' + u.pathname.replace(/^\/(abs|pdf)\//,'').replace(/\.pdf$/i,'').replace(/v\d+$/,'');
    }
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    return u.href.replace(/\/$/,'');
  } catch { return item.id; }
}
export function uniqueMaterials<T extends Material>(items: T[], pending: T[]): T[] {
  const seen = new Set<string>();
  return [...items, ...pending].filter(item => {
    const key = sourceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function observe(items: Material[], pending: Material[], now: number) {
  const entries = uniqueMaterials(items, pending);
  const endDay = Math.floor((now + SHANGHAI_OFFSET) / DAY);
  const days = Array.from({length: 7}, (_, index) => {
    const start = (endDay - 6 + index) * DAY - SHANGHAI_OFFSET;
    return { date: new Date(start + SHANGHAI_OFFSET).toISOString().slice(0,10), count: entries.filter(x => {
      const time = Date.parse(x.publishedAt);
      return time >= start && time < start + DAY && time <= now;
    }).length };
  });
  const start = (endDay - 6) * DAY - SHANGHAI_OFFSET;
  const recent = entries.filter(x => Date.parse(x.publishedAt) >= start && Date.parse(x.publishedAt) <= now);
  return { entries, days, recentCount: recent.length, topics: topics.map(t => ({ ...t, count: recent.filter(x => matchesTopic(x,t.id)).length })) };
}
