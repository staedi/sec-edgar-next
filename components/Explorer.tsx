'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Company {
  id: string
  name: string
  sector: string
  marketCap: number
  filing: string
}

interface Edge {
  source: string
  target: string
  weight: number
  topic: string
  mentions: number
}

interface TopicLeaf {
  name: string
  mentions: number
  avgSim: number
  companies: string[]
  children?: never
}

interface ClusterNode {
  name: string
  color: string
  children: TopicLeaf[]
}

interface DomainNode {
  name: string
  color: string
  children: ClusterNode[]
}

interface RootNode {
  name: string
  children: DomainNode[]
}

type HierarchyInput = RootNode | DomainNode | ClusterNode | TopicLeaf

interface PackedNode {
  name: string
  color?: string
  mentions?: number
  avgSim?: number
  companies?: string[]
  children?: HierarchyInput[]
  cx: number
  cy: number
  r: number
  depth: number
}

interface Position {
  x: number
  y: number
  vx: number
  vy: number
}

interface CrossSel {
  type: 'company' | 'topic'
  id?: string
  name?: string
  companies?: string[]
}

interface SvgTransform {
  x: number
  y: number
  s: number
}

// ── Data ──────────────────────────────────────────────────────────────────────
const COMPANIES: Company[] = [
  { id:'AAPL', name:'Apple Inc.',             sector:'Technology', marketCap:2800, filing:'2023-11-03' },
  { id:'MSFT', name:'Microsoft Corp.',        sector:'Technology', marketCap:2600, filing:'2023-10-26' },
  { id:'GOOGL',name:'Alphabet Inc.',          sector:'Technology', marketCap:1700, filing:'2023-10-24' },
  { id:'AMZN', name:'Amazon.com Inc.',        sector:'Consumer',   marketCap:1600, filing:'2023-10-27' },
  { id:'NVDA', name:'NVIDIA Corp.',           sector:'Technology', marketCap:1200, filing:'2023-11-21' },
  { id:'META', name:'Meta Platforms',         sector:'Technology', marketCap:900,  filing:'2023-10-25' },
  { id:'TSLA', name:'Tesla Inc.',             sector:'Automotive', marketCap:800,  filing:'2023-10-18' },
  { id:'BRK',  name:'Berkshire Hathaway',     sector:'Financial',  marketCap:780,  filing:'2023-11-06' },
  { id:'JPM',  name:'JPMorgan Chase',         sector:'Financial',  marketCap:430,  filing:'2023-10-13' },
  { id:'WMT',  name:'Walmart Inc.',           sector:'Consumer',   marketCap:420,  filing:'2023-12-08' },
  { id:'BAC',  name:'Bank of America',        sector:'Financial',  marketCap:280,  filing:'2023-10-17' },
  { id:'AMD',  name:'Advanced Micro Devices', sector:'Technology', marketCap:210,  filing:'2023-10-31' },
  { id:'INTC', name:'Intel Corp.',            sector:'Technology', marketCap:170,  filing:'2023-10-27' },
  { id:'GS',   name:'Goldman Sachs',          sector:'Financial',  marketCap:120,  filing:'2023-10-17' },
  { id:'F',    name:'Ford Motor Co.',         sector:'Automotive', marketCap:50,   filing:'2023-10-26' },
]

const EDGES: Edge[] = [
  { source:'AAPL', target:'MSFT',  weight:0.87, topic:'Cloud Infrastructure',   mentions:42 },
  { source:'AAPL', target:'GOOGL', weight:0.79, topic:'Mobile OS Competition',  mentions:38 },
  { source:'AAPL', target:'META',  weight:0.62, topic:'AR/VR Hardware',          mentions:29 },
  { source:'AAPL', target:'NVDA',  weight:0.71, topic:'AI Chip Supply Chain',    mentions:33 },
  { source:'MSFT', target:'GOOGL', weight:0.83, topic:'Enterprise AI',           mentions:41 },
  { source:'MSFT', target:'NVDA',  weight:0.92, topic:'AI Infrastructure',       mentions:55 },
  { source:'MSFT', target:'AMZN',  weight:0.74, topic:'Cloud Market Share',      mentions:36 },
  { source:'MSFT', target:'AMD',   weight:0.65, topic:'Data Center Chips',       mentions:28 },
  { source:'GOOGL',target:'NVDA',  weight:0.88, topic:'AI Training Hardware',    mentions:49 },
  { source:'GOOGL',target:'AMZN',  weight:0.76, topic:'Cloud Advertising',       mentions:37 },
  { source:'GOOGL',target:'META',  weight:0.69, topic:'Digital Advertising',     mentions:34 },
  { source:'AMZN', target:'NVDA',  weight:0.81, topic:'AWS GPU Clusters',        mentions:43 },
  { source:'AMZN', target:'WMT',   weight:0.58, topic:'E-commerce Competition',  mentions:27 },
  { source:'NVDA', target:'AMD',   weight:0.84, topic:'GPU Market',              mentions:47 },
  { source:'NVDA', target:'INTC',  weight:0.73, topic:'Semiconductor Race',      mentions:35 },
  { source:'META', target:'GOOGL', weight:0.69, topic:'Ad Revenue',              mentions:34 },
  { source:'TSLA', target:'NVDA',  weight:0.66, topic:'Autonomous AI',           mentions:31 },
  { source:'TSLA', target:'F',     weight:0.77, topic:'EV Competition',          mentions:39 },
  { source:'BRK',  target:'BAC',   weight:0.85, topic:'Major Stakeholder',       mentions:48 },
  { source:'BRK',  target:'JPM',   weight:0.61, topic:'Financial Sector',        mentions:28 },
  { source:'JPM',  target:'BAC',   weight:0.79, topic:'Banking Regulation',      mentions:40 },
  { source:'JPM',  target:'GS',    weight:0.83, topic:'Investment Banking',      mentions:45 },
  { source:'BAC',  target:'GS',    weight:0.71, topic:'Capital Markets',         mentions:33 },
  { source:'AMD',  target:'INTC',  weight:0.89, topic:'CPU/GPU Architecture',    mentions:52 },
  { source:'F',    target:'AMZN',  weight:0.54, topic:'Fleet & Logistics',       mentions:24 },
]

const SECTOR_COLORS: Record<string, string> = {
  Technology:'#2563eb', Consumer:'#d97706', Automotive:'#059669', Financial:'#7c3aed',
}
const SECTOR_BG: Record<string, string> = {
  Technology:'#eff6ff', Consumer:'#fffbeb', Automotive:'#ecfdf5', Financial:'#f5f3ff',
}
const SECTORS = ['All','Technology','Consumer','Automotive','Financial']
const TOPICS  = ['All',...new Set(EDGES.map(e=>e.topic))]

const HIERARCHY: RootNode = {
  name:'root', children:[
    { name:'AI & Cloud', color:'#1d4ed8', children:[
      { name:'Cloud Computing', color:'#2563eb', children:[
        { name:'Cloud Infrastructure',  mentions:42, avgSim:0.87, companies:['AAPL','MSFT'] },
        { name:'Cloud Market Share',    mentions:36, avgSim:0.74, companies:['MSFT','AMZN'] },
        { name:'Cloud Advertising',     mentions:37, avgSim:0.76, companies:['GOOGL','AMZN'] },
        { name:'AWS GPU Clusters',      mentions:43, avgSim:0.81, companies:['AMZN','NVDA'] },
      ]},
      { name:'Artificial Intelligence', color:'#3b82f6', children:[
        { name:'AI Infrastructure',     mentions:55, avgSim:0.92, companies:['MSFT','NVDA'] },
        { name:'Enterprise AI',         mentions:41, avgSim:0.83, companies:['MSFT','GOOGL'] },
        { name:'AI Training Hardware',  mentions:49, avgSim:0.88, companies:['GOOGL','NVDA'] },
        { name:'AI Chip Supply Chain',  mentions:33, avgSim:0.71, companies:['AAPL','NVDA'] },
        { name:'Autonomous AI',         mentions:31, avgSim:0.66, companies:['TSLA','NVDA'] },
      ]},
    ]},
    { name:'Semiconductors', color:'#0891b2', children:[
      { name:'Chip Competition', color:'#06b6d4', children:[
        { name:'GPU Market',            mentions:47, avgSim:0.84, companies:['NVDA','AMD'] },
        { name:'CPU/GPU Architecture',  mentions:52, avgSim:0.89, companies:['AMD','INTC'] },
        { name:'Semiconductor Race',    mentions:35, avgSim:0.73, companies:['NVDA','INTC'] },
        { name:'Data Center Chips',     mentions:28, avgSim:0.65, companies:['MSFT','AMD'] },
      ]},
    ]},
    { name:'Advertising', color:'#b45309', children:[
      { name:'Digital Media', color:'#d97706', children:[
        { name:'Digital Advertising',   mentions:34, avgSim:0.69, companies:['GOOGL','META'] },
        { name:'Ad Revenue',            mentions:34, avgSim:0.69, companies:['META','GOOGL'] },
        { name:'Mobile OS Competition', mentions:38, avgSim:0.79, companies:['AAPL','GOOGL'] },
        { name:'AR/VR Hardware',        mentions:29, avgSim:0.62, companies:['AAPL','META'] },
      ]},
      { name:'Commerce', color:'#f59e0b', children:[
        { name:'E-commerce Competition',mentions:27, avgSim:0.58, companies:['AMZN','WMT'] },
        { name:'Fleet & Logistics',     mentions:24, avgSim:0.54, companies:['F','AMZN'] },
      ]},
    ]},
    { name:'Mobility', color:'#047857', children:[
      { name:'Electric Vehicles', color:'#059669', children:[
        { name:'EV Competition',        mentions:39, avgSim:0.77, companies:['TSLA','F'] },
      ]},
    ]},
    { name:'Finance', color:'#6d28d9', children:[
      { name:'Banking', color:'#7c3aed', children:[
        { name:'Banking Regulation',    mentions:40, avgSim:0.79, companies:['JPM','BAC'] },
        { name:'Investment Banking',    mentions:45, avgSim:0.83, companies:['JPM','GS'] },
        { name:'Capital Markets',       mentions:33, avgSim:0.71, companies:['BAC','GS'] },
        { name:'Financial Sector',      mentions:28, avgSim:0.61, companies:['BRK','JPM'] },
        { name:'Major Stakeholder',     mentions:48, avgSim:0.85, companies:['BRK','BAC'] },
      ]},
    ]},
  ]
}

// ── Sentiment Data ────────────────────────────────────────────────────────────
type WeightCriteria = 'adjPrice' | 'marketCap' | 'txVolume'

interface SentimentRow {
  id: string
  name: string
  sector?: string
  scores: Record<WeightCriteria, { prev: number; curr: number; rolling: number }>
}

const CRITERIA: { key: WeightCriteria; label: string }[] = [
  { key: 'adjPrice',  label: 'Adjusted Price wt. Sentiment Score' },
  { key: 'marketCap', label: 'Market Capitalization wt. Sentiment Score' },
  { key: 'txVolume',  label: 'Transaction Volume wt. Sentiment Score' },
]

const SECTOR_SENTIMENT: SentimentRow[] = [
  { id:'tech',    name:'Technology',                scores:{ adjPrice:{prev:8.1,curr:13.4,rolling:11.2}, marketCap:{prev:7.9,curr:13.8,rolling:11.5}, txVolume:{prev:9.2,curr:13.1,rolling:11.0} } },
  { id:'fin',     name:'Financials',                scores:{ adjPrice:{prev:5.8,curr:12.9,rolling:9.4},  marketCap:{prev:5.2,curr:13.2,rolling:9.1},  txVolume:{prev:6.1,curr:11.8,rolling:9.8} } },
  { id:'semi',    name:'Semiconductors',            scores:{ adjPrice:{prev:7.3,curr:11.8,rolling:10.1}, marketCap:{prev:7.8,curr:12.4,rolling:10.5}, txVolume:{prev:8.1,curr:12.0,rolling:10.3} } },
  { id:'health',  name:'Medical & Healthcare',      scores:{ adjPrice:{prev:6.2,curr:9.4,rolling:8.1},   marketCap:{prev:5.9,curr:9.8,rolling:8.3},   txVolume:{prev:6.8,curr:9.1,rolling:8.0} } },
  { id:'auto',    name:'Automotive',                scores:{ adjPrice:{prev:7.1,curr:10.2,rolling:8.9},  marketCap:{prev:6.8,curr:10.5,rolling:9.0},  txVolume:{prev:7.4,curr:9.8,rolling:8.7} } },
  { id:'retail',  name:'Retail',                    scores:{ adjPrice:{prev:5.4,curr:8.7,rolling:7.2},   marketCap:{prev:5.1,curr:8.4,rolling:7.0},   txVolume:{prev:5.8,curr:8.9,rolling:7.5} } },
  { id:'energy',  name:'Energy',                    scores:{ adjPrice:{prev:8.9,curr:7.2,rolling:8.1},   marketCap:{prev:9.1,curr:7.0,rolling:8.3},   txVolume:{prev:8.7,curr:7.5,rolling:8.0} } },
  { id:'software',name:'Software',                  scores:{ adjPrice:{prev:6.8,curr:12.1,rolling:9.8},  marketCap:{prev:6.5,curr:12.4,rolling:9.5},  txVolume:{prev:7.2,curr:11.8,rolling:9.6} } },
  { id:'pharma',  name:'Pharmaceutical',            scores:{ adjPrice:{prev:5.1,curr:7.8,rolling:6.9},   marketCap:{prev:4.9,curr:7.5,rolling:6.7},   txVolume:{prev:5.4,curr:8.1,rolling:7.1} } },
  { id:'telecom', name:'Telecommunications',        scores:{ adjPrice:{prev:6.1,curr:9.1,rolling:7.8},   marketCap:{prev:5.8,curr:9.4,rolling:7.5},   txVolume:{prev:6.4,curr:8.8,rolling:7.6} } },
  { id:'ind',     name:'Industrials',               scores:{ adjPrice:{prev:7.4,curr:11.2,rolling:9.3},  marketCap:{prev:7.2,curr:11.5,rolling:9.1},  txVolume:{prev:7.8,curr:10.9,rolling:9.4} } },
  { id:'conscy',  name:'Consumer Cyclical',         scores:{ adjPrice:{prev:5.9,curr:9.8,rolling:8.0},   marketCap:{prev:5.7,curr:9.5,rolling:7.8},   txVolume:{prev:6.2,curr:10.1,rolling:8.2} } },
]

const COMPANY_SENTIMENT: SentimentRow[] = [
  { id:'NVDA', name:'NVIDIA Corp.',           sector:'Technology',  scores:{ adjPrice:{prev:9.2,curr:14.1,rolling:12.0}, marketCap:{prev:9.5,curr:14.4,rolling:12.3}, txVolume:{prev:10.1,curr:13.8,rolling:12.1} } },
  { id:'MSFT', name:'Microsoft Corp.',        sector:'Technology',  scores:{ adjPrice:{prev:8.4,curr:13.2,rolling:11.1}, marketCap:{prev:8.1,curr:13.5,rolling:11.4}, txVolume:{prev:8.9,curr:12.9,rolling:11.0} } },
  { id:'AAPL', name:'Apple Inc.',             sector:'Technology',  scores:{ adjPrice:{prev:7.8,curr:12.4,rolling:10.5}, marketCap:{prev:8.0,curr:12.8,rolling:10.8}, txVolume:{prev:8.3,curr:12.1,rolling:10.4} } },
  { id:'GOOGL',name:'Alphabet Inc.',          sector:'Technology',  scores:{ adjPrice:{prev:7.1,curr:11.8,rolling:10.0}, marketCap:{prev:7.4,curr:12.1,rolling:10.2}, txVolume:{prev:7.8,curr:11.5,rolling:9.9} } },
  { id:'META', name:'Meta Platforms',         sector:'Technology',  scores:{ adjPrice:{prev:6.9,curr:11.2,rolling:9.4},  marketCap:{prev:6.6,curr:11.5,rolling:9.1},  txVolume:{prev:7.2,curr:10.9,rolling:9.2} } },
  { id:'AMZN', name:'Amazon.com Inc.',        sector:'Consumer',    scores:{ adjPrice:{prev:6.2,curr:10.8,rolling:8.9},  marketCap:{prev:6.0,curr:11.1,rolling:8.7},  txVolume:{prev:6.5,curr:10.5,rolling:8.8} } },
  { id:'TSLA', name:'Tesla Inc.',             sector:'Automotive',  scores:{ adjPrice:{prev:8.1,curr:9.4,rolling:8.8},   marketCap:{prev:7.9,curr:9.7,rolling:8.6},   txVolume:{prev:8.4,curr:9.1,rolling:8.7} } },
  { id:'AMD',  name:'Advanced Micro Devices', sector:'Technology',  scores:{ adjPrice:{prev:7.4,curr:12.8,rolling:10.4}, marketCap:{prev:7.2,curr:13.1,rolling:10.6}, txVolume:{prev:7.8,curr:12.5,rolling:10.3} } },
  { id:'JPM',  name:'JPMorgan Chase',         sector:'Financial',   scores:{ adjPrice:{prev:5.9,curr:11.4,rolling:8.8},  marketCap:{prev:5.6,curr:11.7,rolling:8.5},  txVolume:{prev:6.2,curr:11.1,rolling:8.9} } },
  { id:'GS',   name:'Goldman Sachs',          sector:'Financial',   scores:{ adjPrice:{prev:5.4,curr:10.8,rolling:8.2},  marketCap:{prev:5.1,curr:11.1,rolling:7.9},  txVolume:{prev:5.8,curr:10.5,rolling:8.3} } },
  { id:'BAC',  name:'Bank of America',        sector:'Financial',   scores:{ adjPrice:{prev:4.9,curr:10.1,rolling:7.5},  marketCap:{prev:4.7,curr:10.4,rolling:7.2},  txVolume:{prev:5.2,curr:9.8,rolling:7.6} } },
  { id:'INTC', name:'Intel Corp.',            sector:'Technology',  scores:{ adjPrice:{prev:6.1,curr:8.4,rolling:7.4},   marketCap:{prev:5.9,curr:8.7,rolling:7.1},   txVolume:{prev:6.4,curr:8.1,rolling:7.5} } },
  { id:'F',    name:'Ford Motor Co.',         sector:'Automotive',  scores:{ adjPrice:{prev:6.4,curr:8.9,rolling:7.8},   marketCap:{prev:6.2,curr:9.2,rolling:7.5},   txVolume:{prev:6.7,curr:8.6,rolling:7.9} } },
  { id:'WMT',  name:'Walmart Inc.',           sector:'Consumer',    scores:{ adjPrice:{prev:5.2,curr:8.1,rolling:6.9},   marketCap:{prev:5.0,curr:8.4,rolling:6.7},   txVolume:{prev:5.5,curr:7.8,rolling:7.0} } },
  { id:'BRK',  name:'Berkshire Hathaway',     sector:'Financial',   scores:{ adjPrice:{prev:6.8,curr:10.2,rolling:8.5},  marketCap:{prev:6.5,curr:10.5,rolling:8.2},  txVolume:{prev:7.1,curr:9.9,rolling:8.6} } },
]

// ── Sentiment View ────────────────────────────────────────────────────────────
function DotPlot({ rows, domainMin, domainMax }: { rows: SentimentRow[]; domainMin: number; domainMax: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const rowH = 28, padL = 200, padR = 40, trackW = 380

  const toX = (v: number) => padL + ((v - domainMin) / (domainMax - domainMin)) * trackW

  const ticks = [2, 4, 6, 8, 10, 12, 14].filter(t => t >= domainMin && t <= domainMax)
  const svgH = rows.length * rowH + 32

  return (
    <svg width={padL + trackW + padR} height={svgH} style={{ display:'block', overflow:'visible' }}>
      {/* grid lines + tick labels */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={toX(t)} y1={16} x2={toX(t)} y2={svgH - 4}
            stroke="#f3f4f6" strokeWidth={1}/>
          <text x={toX(t)} y={12} textAnchor="middle"
            fontSize={10} fill="#9ca3af" fontFamily="Inter,system-ui">{t}</text>
        </g>
      ))}

      {rows.map((row, i) => {
        const y = 16 + i * rowH + rowH / 2
        const isHov = hovered === row.id
        const { prev, curr, rolling } = row.scores[CRITERIA[0].key] // placeholder, overridden per criteria
        const xPrev = toX(prev), xCurr = toX(curr), xRoll = toX(rolling)
        const minX = Math.min(xPrev, xCurr, xRoll), maxX = Math.max(xPrev, xCurr, xRoll)

        return (
          <g key={row.id}
            onMouseEnter={() => setHovered(row.id)}
            onMouseLeave={() => setHovered(null)}>
            {/* hover bg */}
            {isHov && <rect x={0} y={y - rowH/2} width={padL + trackW + padR} height={rowH}
              fill="#f9fafb" rx={4}/>}
            {/* row label */}
            <text x={padL - 10} y={y + 4} textAnchor="end"
              fontSize={11.5} fontFamily="Inter,system-ui" fontWeight={isHov ? 600 : 400}
              fill={isHov ? '#111827' : '#374151'}>
              {row.name}
            </text>
            {/* track line */}
            <line x1={minX} y1={y} x2={maxX} y2={y} stroke="#e5e7eb" strokeWidth={1.5}/>
            {/* prev week dot */}
            <circle cx={xPrev} cy={y} r={5} fill="#93c5fd" stroke="#fff" strokeWidth={1.5}/>
            {/* rolling dot */}
            <circle cx={xRoll} cy={y} r={5} fill="#fbbf24" stroke="#fff" strokeWidth={1.5}/>
            {/* this week dot */}
            <circle cx={xCurr} cy={y} r={6} fill="#1e3a5f" stroke="#fff" strokeWidth={1.5}/>
          </g>
        )
      })}
    </svg>
  )
}

function SentimentView() {
  const [groupBy, setGroupBy] = useState<'sector' | 'company'>('sector')
  const [activeCriteria, setActiveCriteria] = useState<WeightCriteria>('adjPrice')
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number } | null>(null)

  const data = groupBy === 'sector' ? SECTOR_SENTIMENT : COMPANY_SENTIMENT
  const domainMin = 2, domainMax = 15
  const padL = 200, padR = 40, trackW = 380
  const rowH = 32, headerH = 48

  const toX = (v: number) => padL + ((v - domainMin) / (domainMax - domainMin)) * trackW
  const ticks = [2, 4, 6, 8, 10, 12, 14]

  const totalH = CRITERIA.length * (headerH + data.length * rowH) + 32

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', background:'#fff' }}>
      {/* dot grid bg */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}>
        <defs>
          <pattern id="dg3" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx=".75" cy=".75" r=".75" fill="#e5e7eb"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dg3)"/>
      </svg>

      <div style={{ flex:1, overflowY:'auto', padding:'28px 40px', position:'relative', zIndex:1 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'#111827', letterSpacing:'-.03em', marginBottom:4 }}>
              Weighted Sentiment Scores
            </h2>
            <p style={{ fontSize:12.5, color:'#6b7280' }}>
              Comparison of sentiment scores weighted by each criterion · Current week vs previous
            </p>
          </div>
          {/* Group toggle */}
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:8, padding:3, gap:2 }}>
            {(['sector','company'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)} style={{
                padding:'6px 18px', borderRadius:6, border:'none', cursor:'pointer',
                fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500, transition:'all .15s',
                background: groupBy === g ? '#fff' : 'transparent',
                color: groupBy === g ? '#111827' : '#9ca3af',
                boxShadow: groupBy === g ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                textTransform:'capitalize',
              }}>{g}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', gap:20, marginBottom:28, alignItems:'center' }}>
          {[
            { color:'#93c5fd', label:'Prev week', r:5 },
            { color:'#1e3a5f', label:'This week', r:6 },
            { color:'#fbbf24', label:'Rolling',   r:5 },
          ].map(({ color, label, r }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width={r*2+2} height={r*2+2}>
                <circle cx={r+1} cy={r+1} r={r} fill={color}/>
              </svg>
              <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* One block per criterion */}
        {CRITERIA.map(({ key, label }) => {
          const svgH = headerH + data.length * rowH

          return (
            <div key={key} style={{ marginBottom:36, background:'rgba(255,255,255,0.85)',
              backdropFilter:'blur(4px)', borderRadius:12, border:'1px solid #f3f4f6',
              padding:'20px 24px', boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:16,
                letterSpacing:'-.01em' }}>{label}</div>

              <svg width={padL + trackW + padR} height={svgH} style={{ display:'block', overflow:'visible' }}>
                {/* tick labels */}
                {ticks.map(t => (
                  <g key={t}>
                    <line x1={toX(t)} y1={20} x2={toX(t)} y2={svgH}
                      stroke="#f3f4f6" strokeWidth={1}/>
                    <text x={toX(t)} y={14} textAnchor="middle"
                      fontSize={10} fill="#9ca3af" fontFamily="Inter,system-ui">{t}</text>
                  </g>
                ))}

                {data.map((row, i) => {
                  const y = headerH/2 + i * rowH + rowH / 2 - 4
                  const { prev, curr, rolling } = row.scores[key]
                  const xPrev = toX(prev), xCurr = toX(curr), xRoll = toX(rolling)
                  const minX = Math.min(xPrev, xCurr, xRoll)
                  const maxX = Math.max(xPrev, xCurr, xRoll)
                  const isHov = hovered?.id === `${key}-${row.id}`

                  return (
                    <g key={row.id}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as SVGGElement).closest('svg')!.getBoundingClientRect()
                        setHovered({ id:`${key}-${row.id}`, x: e.clientX - rect.left, y })
                      }}
                      onMouseLeave={() => setHovered(null)}>
                      {isHov && <rect x={0} y={y - rowH/2 + 4} width={padL + trackW + padR}
                        height={rowH} fill="#f9fafb" rx={4}/>}
                      {/* label */}
                      <text x={padL - 12} y={y + 4} textAnchor="end"
                        fontSize={11.5} fontFamily="Inter,system-ui"
                        fontWeight={isHov ? 600 : 400}
                        fill={isHov ? '#111827' : '#374151'}>
                        {row.name}
                      </text>
                      {/* sector dot for company view */}
                      {groupBy === 'company' && row.sector && (
                        <circle cx={padL - 6} cy={y} r={3.5}
                          fill={SECTOR_COLORS[row.sector] ?? '#9ca3af'}/>
                      )}
                      {/* track */}
                      <line x1={minX} y1={y} x2={maxX} y2={y}
                        stroke="#e5e7eb" strokeWidth={1.5}/>
                      {/* prev week */}
                      <circle cx={xPrev} cy={y} r={5} fill="#93c5fd" stroke="#fff" strokeWidth={1.5}/>
                      {/* rolling */}
                      <circle cx={xRoll} cy={y} r={5} fill="#fbbf24" stroke="#fff" strokeWidth={1.5}/>
                      {/* this week */}
                      <circle cx={xCurr} cy={y} r={6.5} fill="#1e3a5f" stroke="#fff" strokeWidth={2}/>

                      {/* tooltip */}
                      {isHov && (
                        <g transform={`translate(${Math.min(xCurr + 12, trackW + padL - 130)}, ${y - 44})`}>
                          <rect width={130} height={52} rx={6} fill="#111827"/>
                          <text x={10} y={16} fontSize={11} fontWeight={700} fill="#fff" fontFamily="Inter,system-ui">
                            {row.name.split(' ')[0]}
                          </text>
                          <text x={10} y={30} fontSize={10} fill="#9ca3af" fontFamily="Inter,system-ui">
                            Prev: {prev.toFixed(1)} · Roll: {rolling.toFixed(1)}
                          </text>
                          <text x={10} y={44} fontSize={10} fill="#93c5fd" fontFamily="Inter,system-ui">
                            This week: {curr.toFixed(1)}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          )
        })}

        {/* Footer note */}
        <p style={{ fontSize:11, color:'#9ca3af', fontStyle:'italic', marginTop:8 }}>
          Duration: Current and Previous Weeks · Universe: S&P 500 companies
        </p>
      </div>
    </div>
  )
}

// ── Circle packing layout ─────────────────────────────────────────────────────
function packCircles(node: HierarchyInput, cx: number, cy: number, r: number, depth = 0): PackedNode[] {
  const out: PackedNode[] = [{ ...node, cx, cy, r, depth }]
  if (!('children' in node) || !node.children) return out
  const children = node.children as HierarchyInput[]
  const n = children.length

  if (depth === 0) {
    children.forEach((child, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2, cr = r * 0.38, dist = r * 0.52
      out.push(...packCircles(child, cx + dist * Math.cos(a), cy + dist * Math.sin(a), cr, 1))
    })
  } else if (depth === 1) {
    const cr = r * (n === 1 ? 0.72 : 0.55)
    if (n === 1) { out.push(...packCircles(children[0], cx, cy, cr, 2)) }
    else children.forEach((child, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2, dist = r * 0.38
      out.push(...packCircles(child, cx + dist * Math.cos(a), cy + dist * Math.sin(a), cr, 2))
    })
  } else if (depth === 2) {
    const nt = children.length
    const cr = nt <= 1 ? r * 0.65 : nt <= 3 ? r * 0.42 : r * 0.32
    if (nt === 1) { out.push(...packCircles(children[0], cx, cy, cr, 3)) }
    else children.forEach((child, i) => {
      const a = (i / nt) * 2 * Math.PI - Math.PI / 2, dist = r * 0.48
      out.push(...packCircles(child, cx + dist * Math.cos(a), cy + dist * Math.sin(a), cr, 3))
    })
  }
  return out
}

// ── Force layout ──────────────────────────────────────────────────────────────
function useForceLayout(nodes: Company[], edges: Edge[], width: number, height: number) {
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const iterRef = useRef(0)
  const posRef = useRef<Record<string, Position>>({})

  useEffect(() => {
    if (!width || !height) return
    const init: Record<string, Position> = {}
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * 2 * Math.PI, rv = Math.min(width, height) * 0.3
      init[n.id] = { x: width/2 + rv*Math.cos(a), y: height/2 + rv*Math.sin(a), vx: 0, vy: 0 }
    })
    posRef.current = init; iterRef.current = 0
    const tick = () => {
      if (iterRef.current > 300) return
      iterRef.current++
      const p = posRef.current, al = Math.max(0.01, 0.3 * (1 - iterRef.current / 300))
      nodes.forEach(a => nodes.forEach(b => {
        if (a.id === b.id) return
        const dx = p[a.id].x - p[b.id].x, dy = p[a.id].y - p[b.id].y, d = Math.sqrt(dx*dx+dy*dy)||1
        const f = (3400/(d*d))*al
        p[a.id].vx += (dx/d)*f; p[a.id].vy += (dy/d)*f
      }))
      edges.forEach(e => {
        const s = p[e.source], t = p[e.target]; if (!s||!t) return
        const dx = t.x-s.x, dy = t.y-s.y, d = Math.sqrt(dx*dx+dy*dy)||1
        const tg = 110+(1-e.weight)*90, f = ((d-tg)/d)*0.06*al*8
        s.vx+=dx*f; s.vy+=dy*f; t.vx-=dx*f; t.vy-=dy*f
      })
      nodes.forEach(n => {
        p[n.id].vx += (width/2-p[n.id].x)*0.008*al; p[n.id].vy += (height/2-p[n.id].y)*0.008*al
        p[n.id].vx *= 0.82; p[n.id].vy *= 0.82
        p[n.id].x = Math.max(44, Math.min(width-44,  p[n.id].x+p[n.id].vx))
        p[n.id].y = Math.max(44, Math.min(height-44, p[n.id].y+p[n.id].vy))
      })
      setPositions({...p}); requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [width, height, nodes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return positions
}

// ── Topic View ────────────────────────────────────────────────────────────────
interface TopicViewProps {
  crossSel: CrossSel | null
  setCrossSel: (cs: CrossSel | null) => void
  setActiveTab: (tab: string) => void
}

function TopicView({ crossSel, setCrossSel, setActiveTab }: TopicViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims]         = useState({ w: 0, h: 0 })
  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [zoomed, setZoomed]     = useState<string | null>(null)
  const [svgT, setSvgT]         = useState<SvgTransform>({ x: 0, y: 0, s: 1 })
  const animRef = useRef<number>(0)

  useEffect(() => {
    const obs = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      setDims({ w: width, h: height })
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const animateTo = useCallback((tx: number, ty: number, ts: number, from: SvgTransform) => {
    const t0 = performance.now(), dur = 420
    const tick = (now: number) => {
      const t = Math.min(1, (now-t0)/dur), e = t<0.5 ? 2*t*t : -1+(4-2*t)*t
      setSvgT({ x: from.x+(tx-from.x)*e, y: from.y+(ty-from.y)*e, s: from.s+(ts-from.s)*e })
      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(tick)
  }, [])

  const { w, h } = dims
  const rootR = Math.min(w, h) * 0.44
  const allNodes = w > 0 ? packCircles(HIERARCHY, w/2, h/2, rootR) : []
  const allMentions = allNodes.filter(n => n.depth === 3).map(n => n.mentions ?? 0)
  const maxM = Math.max(...allMentions, 1), minM = Math.min(...allMentions, 0)
  const dr = (n: PackedNode) => n.r * (0.55 + ((n.mentions??0 - minM) / (maxM - minM || 1)) * 0.45)

  const crossTopics = new Set<string>()
  if (crossSel?.type === 'company') {
    allNodes.filter(n => n.depth === 3).forEach(n => {
      if ((n.companies ?? []).includes(crossSel.id!)) crossTopics.add(n.name)
    })
  }

  const zoomTo = useCallback((node: PackedNode) => {
    if (!w || !h) return
    const ts = (Math.min(w, h) * 0.45) / (node.r * 1.15)
    animateTo(w/2 - node.cx*ts, h/2 - node.cy*ts, ts, svgT)
  }, [w, h, svgT, animateTo])

  const zoomOut = useCallback(() => {
    animateTo(0, 0, 1, svgT); setZoomed(null)
  }, [svgT, animateTo])

  const handleClick = (ev: React.MouseEvent, node: PackedNode) => {
    ev.stopPropagation()
    if (node.depth === 1 || node.depth === 2) {
      if (zoomed === node.name) { zoomOut(); setSelected(null) }
      else { setZoomed(node.name); zoomTo(node); setSelected(node.name) }
    } else if (node.depth === 3) {
      setSelected(s => s === node.name ? null : node.name)
    }
  }

  const selNode = allNodes.find(n => n.name === selected) ?? null
  const { x: tx, y: ty, s: ts } = svgT

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      <div ref={containerRef}
        style={{ flex:1, position:'relative', background:'#fff', overflow:'hidden' }}
        onClick={() => { if (zoomed) zoomOut(); setSelected(null) }}>

        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          <defs>
            <pattern id="dg2" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx=".75" cy=".75" r=".75" fill="#e5e7eb"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dg2)"/>
        </svg>

        <svg width="100%" height="100%" style={{ display:'block', position:'relative' }}>
          <defs>
            {allNodes.filter(n => n.depth === 1).map(n => (
              <radialGradient key={n.name} id={`rg-${n.name.replace(/\W/g,'')}`} cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor={n.color} stopOpacity="0.16"/>
                <stop offset="100%" stopColor={n.color} stopOpacity="0.03"/>
              </radialGradient>
            ))}
          </defs>

          <g transform={`translate(${tx},${ty}) scale(${ts})`}>
            {/* Depth 1 — domains */}
            {allNodes.filter(n => n.depth === 1).map(n => {
              const isHov = hovered === n.name, isSel = selected === n.name || zoomed === n.name
              return (
                <g key={'d1'+n.name}>
                  <circle cx={n.cx} cy={n.cy} r={n.r}
                    fill={`url(#rg-${n.name.replace(/\W/g,'')})`}
                    stroke={n.color} strokeWidth={isSel||isHov ? 2 : 1}
                    strokeOpacity={isSel||isHov ? 0.7 : 0.25}
                    onClick={ev => handleClick(ev, n)}
                    onMouseEnter={() => setHovered(n.name)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor:'pointer' }}/>
                  <text x={n.cx} y={n.cy - n.r + 18/ts} textAnchor="middle"
                    fontSize={12/ts} fontFamily="Inter,system-ui" fontWeight={700}
                    fill={n.color} opacity={0.9} style={{ pointerEvents:'none', userSelect:'none' }}>
                    {n.name}
                  </text>
                </g>
              )
            })}

            {/* Depth 2 — clusters */}
            {allNodes.filter(n => n.depth === 2).map(n => {
              const isHov = hovered === n.name, isSel = selected === n.name || zoomed === n.name
              return (
                <g key={'d2'+n.name}>
                  <circle cx={n.cx} cy={n.cy} r={n.r}
                    fill={(n.color ?? '#6b7280')+'0a'} stroke={n.color}
                    strokeWidth={isSel||isHov ? 1.8 : 0.8}
                    strokeOpacity={isSel||isHov ? 0.6 : 0.35}
                    strokeDasharray="5 3"
                    onClick={ev => handleClick(ev, n)}
                    onMouseEnter={() => setHovered(n.name)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor:'pointer' }}/>
                  {(isHov||isSel) && (
                    <text x={n.cx} y={n.cy - n.r + 14/ts} textAnchor="middle"
                      fontSize={10/ts} fontFamily="Inter,system-ui" fontWeight={600}
                      fill={n.color} opacity={0.8} style={{ pointerEvents:'none', userSelect:'none' }}>
                      {n.name}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Depth 3 — topic leaves */}
            {allNodes.filter(n => n.depth === 3).map(n => {
              const col = n.color ?? '#6b7280'
              const isHov = hovered === n.name, isSel = selected === n.name
              const isCross = crossTopics.has(n.name)
              const isDim = (selNode?.depth === 3 && !isSel) || (crossTopics.size > 0 && !isCross && !isSel)
              const r = dr(n)
              const words = n.name.split(' '), half = Math.ceil(words.length/2)
              const l1 = words.slice(0, half).join(' '), l2 = words.slice(half).join(' ')
              const fs = Math.max(8, Math.min(11, r*0.38)) / ts

              return (
                <g key={'d3'+n.name} opacity={isDim ? 0.18 : 1}
                  onClick={ev => handleClick(ev, n)}
                  onMouseEnter={() => setHovered(n.name)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor:'pointer' }}>
                  {isSel && <circle cx={n.cx} cy={n.cy} r={r+8/ts} fill="none" stroke={col}
                    strokeWidth={1.5/ts} opacity={0.3} strokeDasharray={`${4/ts} ${3/ts}`}/>}
                  {isCross && !isSel && <circle cx={n.cx} cy={n.cy} r={r+6/ts} fill="none"
                    stroke={col} strokeWidth={2/ts} opacity={0.6}/>}
                  <circle cx={n.cx} cy={n.cy} r={r}
                    fill={isSel ? col : isCross ? col+'28' : isHov ? col+'20' : '#fff'}
                    stroke={col} strokeWidth={isSel ? 0 : (isCross||isHov) ? 2.5/ts : 1.5/ts}
                    style={{ filter: isSel ? 'drop-shadow(0 2px 6px rgba(0,0,0,.13))' : 'drop-shadow(0 1px 3px rgba(0,0,0,.07))', transition:'fill .15s' }}/>
                  {(isHov||isSel||isCross) && (
                    <>
                      <text x={n.cx} y={n.cy + (l2 ? -fs*0.5 : fs*0.4)} textAnchor="middle"
                        fontSize={fs} fontFamily="Inter,system-ui" fontWeight={600}
                        fill={isSel ? '#fff' : col} style={{ pointerEvents:'none', userSelect:'none' }}>
                        {l1}
                      </text>
                      {l2 && <text x={n.cx} y={n.cy + fs*0.9} textAnchor="middle"
                        fontSize={fs} fontFamily="Inter,system-ui" fontWeight={600}
                        fill={isSel ? '#fff' : col} style={{ pointerEvents:'none', userSelect:'none' }}>
                        {l2}
                      </text>}
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hovered && (() => {
          const node = allNodes.find(n => n.name === hovered); if (!node) return null
          const r = node.depth === 3 ? dr(node) : node.r
          const sx = node.cx*ts+tx, sy = node.cy*ts+ty, sr = r*ts
          const tipX = Math.min(sx+sr+12, w-195), tipY = Math.max(10, sy-30)
          return (
            <div style={{ position:'absolute', left:tipX, top:tipY, background:'#fff',
              border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 14px',
              pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,.08)', zIndex:20, minWidth:175 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#111827', marginBottom:2 }}>{node.name}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom: node.depth===3 ? 7 : 4 }}>
                {['—','Domain','Cluster','Topic'][node.depth]}
                {node.depth !== 3 && ' — click to zoom'}
              </div>
              {node.depth === 3 && [['Co-mentions', node.mentions], ['Avg similarity', node.avgSim], ['Companies', (node.companies??[]).join(', ')]].map(([k,v]) => (
                <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', marginBottom:2 }}>
                  <span>{k}</span><b style={{ color:'#111827', marginLeft:8 }}>{String(v)}</b>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Cross-selection banner */}
        {crossSel?.type === 'company' && (
          <div style={{ position:'absolute', top:16, right:16, background:'#111827', color:'#fff',
            borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:500,
            display:'flex', alignItems:'center', gap:10, boxShadow:'0 2px 12px rgba(0,0,0,.15)' }}>
            <span style={{ opacity:0.6 }}>Topics for</span>
            <span style={{ fontWeight:700 }}>{crossSel.id}</span>
            <button onClick={e => { e.stopPropagation(); setCrossSel(null) }} style={{
              background:'rgba(255,255,255,0.15)', border:'none', borderRadius:5, color:'#fff',
              cursor:'pointer', padding:'2px 8px', fontSize:11, fontFamily:'Inter,system-ui',
            }}>✕</button>
          </div>
        )}

        {/* Zoom breadcrumb */}
        {zoomed && (
          <div style={{ position:'absolute', top:16, left:16, background:'rgba(255,255,255,0.95)',
            backdropFilter:'blur(6px)', border:'1px solid #e5e7eb', borderRadius:8,
            padding:'7px 12px', boxShadow:'0 2px 8px rgba(0,0,0,.06)',
            display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={e => { e.stopPropagation(); zoomOut() }} style={{
              background:'none', border:'none', cursor:'pointer', padding:0,
              fontSize:12, color:'#6b7280', fontFamily:'Inter,system-ui', fontWeight:500,
              display:'flex', alignItems:'center', gap:4,
            }}>← Overview</button>
            <span style={{ color:'#e5e7eb' }}>/</span>
            <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{zoomed}</span>
          </div>
        )}

        {/* Legend */}
        <div style={{ position:'absolute', bottom:16, left:16, background:'rgba(255,255,255,0.92)',
          backdropFilter:'blur(6px)', border:'1px solid #e5e7eb', borderRadius:8,
          padding:'7px 14px', fontSize:11, display:'flex', gap:14, alignItems:'center' }}>
          {[{d:false,sz:14,lbl:'Domain — click to zoom'},{d:true,sz:11,lbl:'Cluster'},{d:false,sz:8,lbl:'Topic — hover for name'}].map(({d,sz,lbl}) => (
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width={sz} height={sz}>
                <circle cx={sz/2} cy={sz/2} r={sz/2-1} fill={sz===8?'#e5e7eb':'none'}
                  stroke="#6b7280" strokeWidth={0.9} strokeDasharray={d?'3 2':'none'}/>
              </svg>
              <span style={{ color:'#6b7280', fontWeight:500 }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      {selected && selNode && (
        <div style={{ width:260, borderLeft:'1px solid #e5e7eb', padding:'20px 16px',
          background:'#fafafa', overflowY:'auto', flexShrink:0, animation:'fadeSlide .2s ease' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', letterSpacing:'.08em',
            textTransform:'uppercase', marginBottom:6 }}>
            {['—','Domain','Cluster','Topic'][selNode.depth]}
          </div>
          <div style={{ fontWeight:700, fontSize:17, color:'#111827', letterSpacing:'-.02em',
            lineHeight:1.3, marginBottom:12 }}>
            {selNode.name}
          </div>

          {selNode.depth === 3 && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:14 }}>
                {([['Co-mentions', selNode.mentions], ['Avg sim', selNode.avgSim],
                  ['Companies', (selNode.companies??[]).length],
                  ['Cluster', allNodes.find(n => n.depth===2 && (n.children??[]).some((c: HierarchyInput) => c.name === selNode.name))?.name ?? '—']
                ] as [string, string|number][]).map(([k,v]) => (
                  <div key={k} style={{ background:'#fff', border:'1px solid #f3f4f6', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                setCrossSel({ type:'topic', name:selNode.name, companies:selNode.companies??[] })
                setActiveTab('graph')
              }} style={{ width:'100%', padding:'9px', marginBottom:14, background:'#111827',
                border:'none', borderRadius:8, color:'#fff', cursor:'pointer',
                fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500 }}>
                View in Graph →
              </button>
              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', letterSpacing:'.08em',
                textTransform:'uppercase', marginBottom:10 }}>Companies</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(selNode.companies??[]).map((id: string) => {
                  const co = COMPANIES.find(c => c.id === id); if (!co) return null
                  return (
                    <div key={id} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'8px 12px', background:'#fff', border:'1px solid #f3f4f6', borderRadius:8 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:SECTOR_BG[co.sector],
                        border:`1.5px solid ${SECTOR_COLORS[co.sector]}33`,
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:SECTOR_COLORS[co.sector] }}>{co.id}</span>
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{co.name.split(' ')[0]}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>${co.marketCap}B</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {selNode.depth === 2 && (
            <>
              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', letterSpacing:'.08em',
                textTransform:'uppercase', marginBottom:10 }}>Topics</div>
              {(selNode.children??[]).map((c: HierarchyInput) => (
                <div key={c.name} onClick={() => setSelected(c.name)}
                  style={{ padding:'9px 12px', background:'#fff', border:'1px solid #f3f4f6',
                    borderRadius:8, marginBottom:6, cursor:'pointer',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{c.name}</div>
                    {'mentions' in c && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{c.mentions} co-mentions</div>}
                  </div>
                  <span style={{ color:'#9ca3af', fontSize:11 }}>→</span>
                </div>
              ))}
            </>
          )}
          {selNode.depth === 1 && (
            <>
              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', letterSpacing:'.08em',
                textTransform:'uppercase', marginBottom:10 }}>Clusters</div>
              {(selNode.children??[]).map((c: HierarchyInput) => (
                <div key={c.name} onClick={() => setSelected(c.name)}
                  style={{ padding:'9px 12px', background:'#fff', border:'1px solid #f3f4f6',
                    borderRadius:8, marginBottom:6, cursor:'pointer' }}>
                  <div style={{ fontWeight:600, fontSize:12, color:'#111827', marginBottom:2 }}>{c.name}</div>
                  {'children' in c && <div style={{ fontSize:11, color:'#9ca3af' }}>{c.children?.length} topics</div>}
                </div>
              ))}
            </>
          )}
          <button onClick={() => setSelected(null)} style={{ marginTop:14, width:'100%', padding:'9px',
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, color:'#6b7280',
            cursor:'pointer', fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500 }}>
            Clear selection
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Explorer() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims]                 = useState({ w: 0, h: 0 })
  const [graphSel, setGraphSel]         = useState<string | null>(null)
  const [hovered, setHovered]           = useState<string | null>(null)
  const [filterSector, setFilterSector] = useState('All')
  const [filterTopic, setFilterTopic]   = useState('All')
  const [minWeight, setMinWeight]       = useState(0.5)
  const [dragging, setDragging]         = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [manualPos, setManualPos]       = useState<Record<string, Position>>({})
  const [activeTab, setActiveTab]       = useState('graph')
  const [crossSel, setCrossSel]         = useState<CrossSel | null>(null)
  const [searchQ, setSearchQ]           = useState('')
  const [searchOpen, setSearchOpen]     = useState(false)

  useEffect(() => {
    const obs = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      setDims({ w: width, h: height })
    })
    if (svgRef.current) obs.observe(svgRef.current.parentElement!)
    return () => obs.disconnect()
  }, [])

  const searchResults = searchQ.trim().length > 0
    ? COMPANIES.filter(c =>
        c.id.toLowerCase().includes(searchQ.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQ.toLowerCase())
      ).slice(0, 6)
    : []

  const handleSearchSelect = (company: Company) => {
    setGraphSel(company.id)
    setActiveTab('graph')
    setSearchQ('')
    setSearchOpen(false)
  }

  const visibleNodes = COMPANIES.filter(n => filterSector === 'All' || n.sector === filterSector)
  const visibleIds = new Set(visibleNodes.map(n => n.id))
  const visibleEdges = EDGES.filter(e =>
    visibleIds.has(e.source) && visibleIds.has(e.target) &&
    e.weight >= minWeight && (filterTopic === 'All' || e.topic === filterTopic)
  )
  const positions = useForceLayout(visibleNodes, visibleEdges, dims.w, dims.h)
  const getPos = (id: string) => manualPos[id] || positions[id]
  const selNode = COMPANIES.find(c => c.id === graphSel)
  const selEdges = graphSel ? visibleEdges.filter(e => e.source === graphSel || e.target === graphSel) : []
  const connIds = new Set(selEdges.flatMap(e => [e.source, e.target]))
  const crossNodes = new Set<string>(crossSel?.type === 'topic' ? (crossSel.companies ?? []) : [])
  const nodeR = (n: Company) => Math.max(28, Math.min(42, Math.sqrt(n.marketCap) * 1.1))

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const pos = getPos(id), rect = svgRef.current!.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left - pos.x, y: e.clientY - rect.top - pos.y }
    setDragging(id)
  }
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const rect = svgRef.current!.getBoundingClientRect()
    setManualPos(p => ({...p, [dragging]: {
      x: Math.max(44, Math.min(dims.w-44, e.clientX - rect.left - dragOffset.current.x)),
      y: Math.max(44, Math.min(dims.h-44, e.clientY - rect.top  - dragOffset.current.y)),
      vx: 0, vy: 0,
    }}))
  }, [dragging, dims])

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#fff',
      fontFamily:"'Inter',system-ui,sans-serif", color:'#111827',
      display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#f9fafb;}
        ::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px;}
        .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:6px;
          border:1px solid #e5e7eb;background:#fff;font-size:12px;font-family:Inter,system-ui;
          cursor:pointer;color:#6b7280;transition:all .12s;white-space:nowrap;width:100%;}
        .pill:hover{border-color:#d1d5db;color:#374151;background:#f9fafb;}
        .pill.active{background:#111827;color:#fff;border-color:#111827;}
        .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .range-input{-webkit-appearance:none;width:100%;height:3px;
          background:linear-gradient(to right,#111827 var(--pct),#e5e7eb var(--pct));
          outline:none;border-radius:2px;cursor:pointer;}
        .range-input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;
          border-radius:50%;background:#fff;border:2px solid #111827;
          cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.15);}
        .rel-card{border:1px solid #f3f4f6;border-radius:8px;padding:10px 12px;
          cursor:pointer;transition:all .12s;background:#fff;}
        .rel-card:hover{border-color:#e5e7eb;background:#fafafa;}
        .sec-label{font-size:10px;font-weight:600;color:#9ca3af;
          letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;}
        @keyframes fadeSlide{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
      `}</style>

      {/* Navbar */}
      <nav style={{ height:60, borderBottom:'1px solid #e5e7eb', padding:'0 24px',
        display:'flex', alignItems:'center', gap:12,
        background:'rgba(255,255,255,.95)', backdropFilter:'blur(10px)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2"  y="2"  width="8" height="8" rx="2" fill="#111827"/>
            <rect x="12" y="2"  width="8" height="8" rx="2" fill="#111827" opacity=".3"/>
            <rect x="2"  y="12" width="8" height="8" rx="2" fill="#111827" opacity=".3"/>
            <rect x="12" y="12" width="8" height="8" rx="2" fill="#111827"/>
          </svg>
          <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-.03em', color:'#111827' }}>
            SEC EDGAR Explorer
          </span>
        </div>
        <span style={{ color:'#e5e7eb', fontSize:20, fontWeight:200 }}>/</span>
        <span style={{ fontSize:13, color:'#9ca3af', fontWeight:400, letterSpacing:'-.01em' }}>
          {activeTab === 'graph' ? '10-K Relationship Graph' : 'Topic Clusters'}
        </span>

        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          {/* Search */}
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7,
              background:'#f3f4f6', borderRadius:8, padding:'6px 12px',
              border:`1.5px solid ${searchOpen ? '#d1d5db' : 'transparent'}`,
              transition:'border-color .15s', width:220 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="#9ca3af" strokeWidth="1.5"/>
                <path d="M9.5 9.5L12 12" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Search company..."
                style={{ border:'none', background:'transparent', outline:'none',
                  fontSize:12, fontFamily:'Inter,system-ui', color:'#111827', width:'100%' }}
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(''); setSearchOpen(false) }} style={{
                  background:'none', border:'none', cursor:'pointer', padding:0,
                  color:'#9ca3af', fontSize:14, lineHeight:1, flexShrink:0,
                }}>✕</button>
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
                background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:100, overflow:'hidden' }}>
                {searchResults.map((c, i) => (
                  <div key={c.id}
                    onMouseDown={() => handleSearchSelect(c)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      cursor:'pointer', borderBottom: i < searchResults.length-1 ? '1px solid #f3f4f6' : 'none',
                      background:'#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <div style={{ width:30, height:30, borderRadius:7, flexShrink:0,
                      background:SECTOR_BG[c.sector], border:`1.5px solid ${SECTOR_COLORS[c.sector]}33`,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:9, fontWeight:700, color:SECTOR_COLORS[c.sector] }}>{c.id}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#111827',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{c.sector} · ${c.marketCap}B</div>
                    </div>
                    <span style={{ fontSize:10, color:'#d1d5db', flexShrink:0 }}>↵</span>
                  </div>
                ))}
              </div>
            )}
            {searchOpen && searchQ.trim().length > 0 && searchResults.length === 0 && (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
                background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:100,
                padding:'12px', fontSize:12, color:'#9ca3af', textAlign:'center' }}>
                No matches found
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:16, fontSize:12.5, color:'#6b7280', marginRight:8 }}>
            <span><b style={{ color:'#111827', fontWeight:600 }}>{visibleNodes.length}</b> companies</span>
            <span><b style={{ color:'#111827', fontWeight:600 }}>
              {activeTab === 'graph' ? visibleEdges.length : EDGES.length}
            </b> {activeTab === 'graph' ? 'edges' : 'co-mentions'}</span>
          </div>
          <span style={{ background:'#f3f4f6', borderRadius:6, padding:'3px 10px',
            color:'#374151', fontSize:11, fontWeight:600, letterSpacing:'.02em' }}>2023 Filings</span>
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:8, padding:3, gap:2, marginLeft:8 }}>
            {[['graph','Graph'],['topics','Topics'],['sentiment','Sentiment']].map(([key, lbl]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                padding:'5px 16px', borderRadius:6, border:'none', cursor:'pointer',
                fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500, transition:'all .15s',
                background: activeTab === key ? '#fff' : 'transparent',
                color: activeTab === key ? '#111827' : '#9ca3af',
                boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </nav>

      {activeTab === 'sentiment'
        ? <SentimentView />
        : activeTab === 'topics'
        ? <TopicView crossSel={crossSel} setCrossSel={setCrossSel} setActiveTab={setActiveTab}/>
        : (
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Sidebar */}
          <aside style={{ width:220, borderRight:'1px solid #e5e7eb', padding:'20px 16px',
            display:'flex', flexDirection:'column', gap:22, overflowY:'auto',
            background:'#fafafa', flexShrink:0 }}>
            <div>
              <div className="sec-label">Sector</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {SECTORS.map(s => (
                  <button key={s} className={`pill ${filterSector === s ? 'active' : ''}`}
                    onClick={() => setFilterSector(s)}>
                    {s !== 'All' && <span className="dot" style={{ background: filterSector===s ? '#fff' : SECTOR_COLORS[s] }}/>}
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                <div className="sec-label" style={{ marginBottom:0 }}>Min Similarity</div>
                <span style={{ fontSize:13, fontWeight:700, color:'#111827', letterSpacing:'-.02em' }}>{minWeight.toFixed(2)}</span>
              </div>
              <input type="range" className="range-input" min={0} max={1} step={0.05}
                value={minWeight} style={{'--pct': `${minWeight*100}%`} as React.CSSProperties}
                onChange={e => setMinWeight(+e.target.value)}/>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'#e5e7eb' }}>
                <span>0.0</span><span>1.0</span>
              </div>
            </div>
            <div>
              <div className="sec-label">Topic</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {TOPICS.slice(0,10).map(t => (
                  <button key={t} className={`pill ${filterTopic === t ? 'active' : ''}`}
                    style={{ fontSize:11, overflow:'hidden', textOverflow:'ellipsis' }}
                    onClick={() => setFilterTopic(t)} title={t}>{t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid #f3f4f6' }}>
              <div className="sec-label">Legend</div>
              {Object.entries(SECTOR_COLORS).map(([s,c]) => (
                <div key={s} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span className="dot" style={{ background:c }}/>
                  <span style={{ fontSize:12, color:'#374151', fontWeight:500 }}>{s}</span>
                </div>
              ))}
              <p style={{ marginTop:14, fontSize:11, color:'#9ca3af', lineHeight:1.9 }}>
                Node size = market cap<br/>Edge width = similarity<br/>Click · Drag to explore
              </p>
            </div>
          </aside>

          {/* Graph canvas */}
          <div style={{ flex:1, position:'relative', background:'#fff', overflow:'hidden' }}
            onMouseMove={onMouseMove}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}>
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
              <defs>
                <pattern id="dotgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx=".75" cy=".75" r=".75" fill="#e5e7eb"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotgrid)"/>
            </svg>
            <svg ref={svgRef} width="100%" height="100%"
              onClick={() => setGraphSel(null)}
              style={{ display:'block', position:'relative' }}>
              <defs>
                <filter id="ns" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#00000014"/>
                </filter>
                <filter id="nss" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#00000020"/>
                </filter>
              </defs>

              {visibleEdges.map(e => {
                const s = getPos(e.source), t = getPos(e.target)
                if (!s||!t) return null
                const isHl = !!(graphSel && (e.source === graphSel || e.target === graphSel))
                const isDim = !!(graphSel && !isHl)
                const col = isHl ? (SECTOR_COLORS[selNode?.sector ?? ''] || '#374151') : '#d1d5db'
                const mx = (s.x+t.x)/2+(t.y-s.y)*.1, my = (s.y+t.y)/2-(t.x-s.x)*.1
                return (
                  <g key={e.source+e.target} opacity={isDim ? .1 : isHl ? 1 : .8}>
                    <path d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`}
                      fill="none" stroke={col}
                      strokeWidth={isHl ? 2.5 : Math.max(1, e.weight*2)} strokeLinecap="round"/>
                    {isHl && <text x={mx} y={my-7} textAnchor="middle"
                      fontSize={10} fontFamily="Inter,system-ui" fontWeight={500} fill={col}>
                      {e.topic}
                    </text>}
                  </g>
                )
              })}

              {visibleNodes.map(n => {
                const pos = getPos(n.id); if (!pos) return null
                const r = nodeR(n), col = SECTOR_COLORS[n.sector], bg = SECTOR_BG[n.sector]
                const isSel = graphSel === n.id, isConn = connIds.has(n.id)
                const isCross = crossNodes.has(n.id), isHov = hovered === n.id
                const isDim = (graphSel && !isSel && !isConn) || (crossNodes.size > 0 && !isCross && !isSel)
                return (
                  <g key={n.id} opacity={isDim ? .15 : 1}
                    onMouseDown={e => onMouseDown(e, n.id)}
                    onClick={e => { e.stopPropagation(); setGraphSel(s => s === n.id ? null : n.id) }}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor:'pointer' }}>
                    {isSel && <circle cx={pos.x} cy={pos.y} r={r+9} fill="none"
                      stroke={col} strokeWidth={1.5} opacity={.25} strokeDasharray="5 3"/>}
                    {isCross && !isSel && <circle cx={pos.x} cy={pos.y} r={r+7} fill="none"
                      stroke={col} strokeWidth={2} opacity={0.5}/>}
                    <circle cx={pos.x} cy={pos.y} r={r}
                      fill={isSel ? col : bg} stroke={col}
                      strokeWidth={isSel ? 0 : (isCross||isHov) ? 2.5 : 1.5}
                      filter={isSel ? 'url(#nss)' : 'url(#ns)'}/>
                    <text x={pos.x} y={pos.y+2} textAnchor="middle"
                      fontSize={13} fontFamily="Inter,system-ui" fontWeight={700} letterSpacing="-0.5"
                      fill={isSel ? '#fff' : col}>{n.id}</text>
                    <text x={pos.x} y={pos.y+15} textAnchor="middle"
                      fontSize={9} fontFamily="Inter,system-ui" fontWeight={500}
                      fill={isSel ? 'rgba(255,255,255,0.6)' : col} opacity={0.65}>
                      {n.marketCap >= 1000 ? `$${(n.marketCap/1000).toFixed(1)}T` : `$${n.marketCap}B`}
                    </text>
                    <text x={pos.x} y={pos.y+r+15} textAnchor="middle"
                      fontSize={9.5} fontFamily="Inter,system-ui" fontWeight={500}
                      fill={isHov||isSel||isCross ? '#374151' : '#9ca3af'}>{n.name.split(' ')[0]}</text>
                  </g>
                )
              })}
            </svg>

            {hovered && !graphSel && (() => {
              const n = COMPANIES.find(c => c.id === hovered), pos = getPos(hovered)
              if (!n||!pos) return null
              const conns = visibleEdges.filter(e => e.source === n.id || e.target === n.id).length
              return (
                <div style={{ position:'absolute', left:pos.x+nodeR(n)+12, top:pos.y-20,
                  background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                  padding:'10px 14px', pointerEvents:'none',
                  boxShadow:'0 4px 20px rgba(0,0,0,.08)', zIndex:20, minWidth:168 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'#111827', marginBottom:6 }}>{n.name}</div>
                  <div style={{ display:'inline-block', fontSize:11, fontWeight:500, padding:'2px 8px',
                    borderRadius:5, background:SECTOR_BG[n.sector], color:SECTOR_COLORS[n.sector], marginBottom:7 }}>
                    {n.sector}
                  </div>
                  {[['Market cap', `$${n.marketCap}B`], ['Connections', conns], ['10-K filed', n.filing]].map(([k,v]) => (
                    <div key={String(k)} style={{ display:'flex', justifyContent:'space-between',
                      fontSize:12, color:'#6b7280', marginBottom:2 }}>
                      <span>{k}</span><b style={{ color:'#111827' }}>{v}</b>
                    </div>
                  ))}
                </div>
              )
            })()}

            {crossSel?.type === 'topic' && (
              <div style={{ position:'absolute', top:16, right:16, background:'#111827', color:'#fff',
                borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:500,
                display:'flex', alignItems:'center', gap:10, boxShadow:'0 2px 12px rgba(0,0,0,.15)' }}>
                <span style={{ opacity:0.6 }}>Companies for</span>
                <span style={{ fontWeight:700 }}>{crossSel.name}</span>
                <button onClick={() => setCrossSel(null)} style={{
                  background:'rgba(255,255,255,0.15)', border:'none', borderRadius:5, color:'#fff',
                  cursor:'pointer', padding:'2px 8px', fontSize:11, fontFamily:'Inter,system-ui',
                }}>✕</button>
              </div>
            )}
          </div>

          {/* Right panel */}
          {graphSel && selNode && (
            <div style={{ width:260, borderLeft:'1px solid #e5e7eb', padding:'18px 14px',
              background:'#fafafa', overflowY:'auto', flexShrink:0, animation:'fadeSlide .2s ease' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:10,
                  background:SECTOR_BG[selNode.sector],
                  border:`1.5px solid ${SECTOR_COLORS[selNode.sector]}33`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontWeight:700, fontSize:11, color:SECTOR_COLORS[selNode.sector] }}>{selNode.id}</span>
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:'#111827', lineHeight:1.3 }}>{selNode.name}</div>
                  <div style={{ marginTop:3, fontSize:11, fontWeight:500, padding:'1px 7px', borderRadius:5,
                    display:'inline-block', background:SECTOR_BG[selNode.sector], color:SECTOR_COLORS[selNode.sector] }}>
                    {selNode.sector}
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:14 }}>
                {([['Market Cap', `$${selNode.marketCap}B`], ['Connections', selEdges.length],
                  ['Filed', selNode.filing],
                  ['Avg Sim', selEdges.length ? (selEdges.reduce((a,e) => a+e.weight, 0)/selEdges.length).toFixed(2) : '—']
                ] as [string, string|number][]).map(([k,v]) => (
                  <div key={k} style={{ background:'#fff', border:'1px solid #f3f4f6', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                setCrossSel({ type:'company', id:selNode.id })
                setActiveTab('topics')
              }} style={{ width:'100%', padding:'9px', marginBottom:14, background:'#111827',
                border:'none', borderRadius:8, color:'#fff', cursor:'pointer',
                fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500 }}>
                View in Topics →
              </button>
              <div className="sec-label">Relationships</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {selEdges.sort((a,b) => b.weight-a.weight).map(e => {
                  const oid = e.source === graphSel ? e.target : e.source
                  const other = COMPANIES.find(c => c.id === oid)
                  return (
                    <div key={e.source+e.target} className="rel-card" onClick={() => setGraphSel(oid)}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span className="dot" style={{ background:SECTOR_COLORS[other?.sector ?? ''] }}/>
                          <span style={{ fontWeight:600, fontSize:13, color:'#111827' }}>{oid}</span>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:SECTOR_COLORS[selNode.sector] }}>{e.weight.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>{e.topic}</div>
                      <div style={{ height:3, background:'#f3f4f6', borderRadius:2 }}>
                        <div style={{ height:'100%', width:`${e.weight*100}%`,
                          background:SECTOR_COLORS[selNode.sector], borderRadius:2, opacity:.6 }}/>
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>{e.mentions} co-mentions</div>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setGraphSel(null)} style={{ marginTop:14, width:'100%', padding:'9px',
                background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, color:'#6b7280',
                cursor:'pointer', fontFamily:'Inter,system-ui', fontSize:12, fontWeight:500 }}>
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
