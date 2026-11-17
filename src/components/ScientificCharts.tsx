import {
  ATMOSPHERE_LAYERS,
  HISTORY_ERAS,
  INTERIOR_LAYERS,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
} from '../data/earthData';
import { interpolateAtmosphereTemp } from '../utils/earthMath';

export function InteriorDepthChart({ selectedId }: { selectedId: InteriorLayerId }) {
  // Depth 0 -> 6371 km mapped horizontally; Temp 0 -> 6000°C mapped vertically
  const points = [
    { km: 0, temp: 15 },
    { km: 50, temp: 500 },
    { km: 660, temp: 1900 },
    { km: 2890, temp: 4000 },
    { km: 5150, temp: 5300 },
    { km: 6371, temp: 5700 },
  ];

  const w = 316;
  const h = 112;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const toX = (km: number) => padL + (km / 6371) * plotW;
  const toY = (temp: number) => padT + plotH - (temp / 6000) * plotH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.km).toFixed(1)} ${toY(p.temp).toFixed(1)}`)
    .join(' ');

  const bands: Array<{ id: InteriorLayerId; from: number; to: number; color: string }> = [
    { id: 'crust', from: 0, to: 70, color: '#38bdf8' },
    { id: 'upper-mantle', from: 70, to: 660, color: '#d97706' },
    { id: 'lower-mantle', from: 660, to: 2890, color: '#b91c1c' },
    { id: 'outer-core', from: 2890, to: 5150, color: '#ea580c' },
    { id: 'inner-core', from: 5150, to: 6371, color: '#fbbf24' },
  ];

  const selectedLayer = INTERIOR_LAYERS.find((l) => l.id === selectedId);

  return (
    <div className="border border-neutral-800 bg-[#1a1a1a] rounded-lg p-3">
      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
        <span className="font-medium text-neutral-200">Geothermal Profile (Depth vs. Temp)</span>
        <span className="font-mono-tabular text-[#e0a43b]">{selectedLayer?.temperature}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 overflow-visible" role="img" aria-label="Earth interior depth and temperature profile chart">
        {bands.map((b) => {
          const x1 = toX(b.from);
          const bw = Math.max(2, toX(b.to) - x1);
          const active = b.id === selectedId;
          return (
            <rect
              key={b.id}
              x={x1}
              y={padT}
              width={bw}
              height={plotH}
              fill={b.color}
              fillOpacity={active ? 0.24 : 0.06}
              stroke={active ? b.color : 'none'}
              strokeWidth={active ? 1 : 0}
            />
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#334155" strokeWidth="1" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth="1" />
        <path d={pathD} fill="none" stroke="#fbbf24" strokeWidth="2" />
        <text x={padL} y={h - 5} fill="#94a3b8" fontSize="9" className="font-mono-tabular">0 km</text>
        <text x={toX(2890) - 18} y={h - 5} fill="#94a3b8" fontSize="9" className="font-mono-tabular">2,890</text>
        <text x={w - padR - 36} y={h - 5} fill="#94a3b8" fontSize="9" className="font-mono-tabular">6,371</text>
        <text x={2} y={padT + 8} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">6k°C</text>
        <text x={8} y={padT + plotH} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">0°</text>
      </svg>
    </div>
  );
}

export function AtmosphereProfileChart({ selectedId }: { selectedId: AtmosphereLayerId }) {
  // Altitude 0 -> 200 km mapped vertically (log-like/piecewise), Temperature -100 to +600 °C horizontally
  const w = 316;
  const h = 132;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const altSamples = [0, 11, 20, 47, 51, 85, 100, 120, 160];
  const maxAlt = 160;
  const minT = -100;
  const maxT = 500;

  const toX = (temp: number) =>
    padL + (Math.max(minT, Math.min(maxT, temp)) - minT) / (maxT - minT) * plotW;
  const toY = (alt: number) => padT + plotH - (Math.min(maxAlt, alt) / maxAlt) * plotH;

  const pathD = altSamples
    .map((alt, i) => {
      const t = interpolateAtmosphereTemp(alt);
      return `${i === 0 ? 'M' : 'L'} ${toX(t).toFixed(1)} ${toY(alt).toFixed(1)}`;
    })
    .join(' ');

  const bands: Array<{ id: AtmosphereLayerId; min: number; max: number; color: string }> = [
    { id: 'troposphere', min: 0, max: 12, color: '#38bdf8' },
    { id: 'stratosphere', min: 12, max: 50, color: '#6366f1' },
    { id: 'mesosphere', min: 50, max: 85, color: '#8b5cf6' },
    { id: 'thermosphere', min: 85, max: 145, color: '#e0a43b' },
    { id: 'exosphere', min: 145, max: 160, color: '#94a3b8' },
  ];

  const activeLayer = ATMOSPHERE_LAYERS.find((l) => l.id === selectedId);

  return (
    <div className="border border-neutral-800 bg-[#1a1a1a] rounded-lg p-3">
      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
        <span className="font-medium text-neutral-200">Altitude Thermal Profile</span>
        <span className="font-mono-tabular text-[#e0a43b]">{activeLayer?.altitudeKm}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32 overflow-visible" role="img" aria-label="Atmosphere temperature versus altitude profile">
        {bands.map((b) => {
          const yTop = toY(b.max);
          const bh = Math.max(2, toY(b.min) - yTop);
          const active = b.id === selectedId;
          return (
            <rect
              key={b.id}
              x={padL}
              y={yTop}
              width={plotW}
              height={bh}
              fill={b.color}
              fillOpacity={active ? 0.24 : 0.05}
            />
          );
        })}
        {/* Kármán Line at 100 km */}
        <line
          x1={padL}
          y1={toY(100)}
          x2={w - padR}
          y2={toY(100)}
          stroke="#475569"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text x={w - padR - 64} y={toY(100) - 3} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">
          100 km Space
        </text>
        <line x1={toX(0)} y1={padT} x2={toX(0)} y2={padT + plotH} stroke="#1e293b" strokeWidth="1" />
        <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2" />
        <text x={2} y={toY(150)} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">150km</text>
        <text x={6} y={toY(85)} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">85km</text>
        <text x={6} y={toY(50)} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">50km</text>
        <text x={12} y={toY(0)} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">0km</text>
        <text x={padL} y={h - 5} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">-100°C</text>
        <text x={toX(0) - 8} y={h - 5} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">0°C</text>
        <text x={w - padR - 32} y={h - 5} fill="#94a3b8" fontSize="8.5" className="font-mono-tabular">+500°C</text>
      </svg>
    </div>
  );
}

export function HistoryOxygenChart({ selectedEra }: { selectedEra: HistoryEraId }) {
  const w = 316;
  const h = 104;
  const padL = 28;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const toX = (idx: number) => padL + (idx / (HISTORY_ERAS.length - 1)) * plotW;
  const toY = (o2: number) => padT + plotH - (Math.min(35, o2) / 35) * plotH;

  const pathD = HISTORY_ERAS.map(
    (era, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(1)} ${toY(era.oxygenPercent).toFixed(1)}`
  ).join(' ');

  const currentEra = HISTORY_ERAS.find((e) => e.id === selectedEra);

  return (
    <div className="border border-neutral-800 bg-[#1a1a1a] rounded-lg p-3">
      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
        <span className="font-medium text-neutral-200">Atmospheric O₂ Evolution (4.54 Ga → Now)</span>
        <span className="font-mono-tabular text-[#e0a43b]">{currentEra?.oxygenPercent}% O₂</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 overflow-visible" role="img" aria-label="Earth atmospheric oxygen evolution over deep time">
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#404040" strokeWidth="1" />
        <path d={pathD} fill="none" stroke="#e0a43b" strokeWidth="2" />
        {HISTORY_ERAS.map((era, idx) => {
          const cx = toX(idx);
          const cy = toY(era.oxygenPercent);
          const active = era.id === selectedEra;
          return (
            <circle
              key={era.id}
              cx={cx}
              cy={cy}
              r={active ? 4.5 : 2.5}
              fill={active ? '#ffffff' : '#e0a43b'}
              stroke="#1a1a1a"
              strokeWidth="1.5"
            />
          );
        })}
        <text x={padL} y={h - 5} fill="#a3a3a3" fontSize="8.5" className="font-mono-tabular">4.54 Ga</text>
        <text x={toX(2) - 14} y={h - 5} fill="#a3a3a3" fontSize="8.5" className="font-mono-tabular">2.5 Ga</text>
        <text x={w - padR - 34} y={h - 5} fill="#a3a3a3" fontSize="8.5" className="font-mono-tabular">Present</text>
        <text x={2} y={padT + 8} fill="#a3a3a3" fontSize="8.5" className="font-mono-tabular">35%</text>
        <text x={8} y={padT + plotH} fill="#a3a3a3" fontSize="8.5" className="font-mono-tabular">0%</text>
      </svg>
    </div>
  );
}
