import React, { useMemo } from 'react';
import { ArrowUpRight, Activity } from 'lucide-react';
import { observe } from '../lib/observatory.ts';

export function Observatory({ data, topic, onTopic }) {
  const snapshot = useMemo(() => observe(data.items, data.pending, Date.parse(data.updatedAt)), [data]);
  const max = Math.max(1, ...snapshot.days.map(d => d.count));
  const healthy = data.sources.filter(s => s.status === 'ok').length;
  return <section className="observatory" aria-labelledby="observatory-heading">
    <div className="observatory-intro">
      <div className="observatory-eyebrow"><span className="signal-dot"/> FRONTIER OBSERVATORY <span>01 / EXPLORE</span></div>
      <h2 id="observatory-heading">前沿正在<br/>发生什么？</h2>
      <p>沿着问题找研究，<br/>从线索走到原文证据。</p>
      <div className="observatory-metrics">
        <div><strong>{data.items.length.toString().padStart(2,'0')}</strong><span>已核查档案</span></div>
        <div><strong>{data.pending.length}</strong><span>公开候选题录</span></div>
      </div>
      <div className="observatory-health"><Activity size={14}/>{healthy} / {data.sources.length} 个来源最近检查成功</div>
    </div>
    <div className="topic-map">
      <div className="map-heading"><span>主题坐标</span><span>点击探索 ↗</span></div>
      <svg className="orbit-lines" viewBox="0 0 700 360" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="350" cy="180" rx="230" ry="120"/>
        <ellipse cx="350" cy="180" rx="290" ry="70" transform="rotate(-24 350 180)"/>
        <path d="M90 180H610M350 25V335"/>
      </svg>
      <div className="map-center"><span>近 7 个自然日</span><strong>{snapshot.recentCount}</strong><span>去重研究线索</span></div>
      <div className="map-nodes">
        {snapshot.topics.filter(t => t.id !== 'other').map((t,i) => <button key={t.id}
          className={`map-node node-${i} ${topic === t.id ? 'selected' : ''}`}
          style={{'--topic-color':t.color}} aria-label={`探索主题：${t.label}`} aria-pressed={topic === t.id}
          onClick={() => onTopic(topic === t.id ? 'all' : t.id)}>
          <span className="node-dot"/><span>{t.label}<small>{t.count} 条近期线索</small></span><ArrowUpRight size={14}/>
        </button>)}
      </div>
      <p className="map-note">标题与标签的关键词匹配 · 一项可属多个主题 · 坐标仅作导航</p>
    </div>
    <div className="observatory-activity">
      <div className="activity-caption"><span className="observatory-eyebrow">07 DAYS / SOURCE ACTIVITY</span><h3>原文发表节奏</h3><p>截至 {snapshot.days.at(-1)?.date} 的公开快照<br/>本站收录量，不代表全网热度</p></div>
      <div className="activity-bars" role="img" aria-label={`近七个上海自然日原文发表数量：${snapshot.days.map(d => `${d.date} ${d.count}条`).join('，')}`}>
        {snapshot.days.map(d => <div className="activity-day" key={d.date}><span>{d.count}</span><div className="bar-track"><i style={{height:`${d.count/max*100}%`}}/></div><time dateTime={d.date}>{d.date.slice(5).replace('-','/')}</time></div>)}
      </div>
    </div>
  </section>;
}
