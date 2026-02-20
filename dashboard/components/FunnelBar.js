'use client';

const STAGE_COLORS = {
  New: 'bg-gray-300',
  Invited: 'bg-blue-400',
  Connected: 'bg-green-400',
  Messaged: 'bg-orange-400',
  Replied: 'bg-purple-400',
  Meeting: 'bg-red-400',
};

export default function FunnelBar({ stages = {} }) {
  const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const total = stageOrder.reduce((sum, s) => sum + (stages[s] || 0), 0);

  if (total === 0) {
    return <p className="text-sm text-gray-400">Нет данных</p>;
  }

  return (
    <div>
      {/* Bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-3">
        {stageOrder.map((stage) => {
          const count = stages[stage] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={stage}
              className={`${STAGE_COLORS[stage]} flex items-center justify-center text-xs font-semibold text-white`}
              style={{ width: `${pct}%` }}
              title={`${stage}: ${count}`}
            >
              {pct > 8 ? count : ''}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {stageOrder.map((stage) => (
          <div key={stage} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[stage]}`} />
            {stage}: {stages[stage] || 0}
          </div>
        ))}
      </div>
    </div>
  );
}
