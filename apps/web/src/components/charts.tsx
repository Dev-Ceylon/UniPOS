/**
 * Minimal, dependency-free SVG charts. Single-series bars use the theme's
 * primary colour; values are also exposed as an accessible table.
 */
export function BarChart({
  data,
  format,
  height = 180,
  label,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(1, data.length);
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label={label}>
        <line x1="0" x2="100" y1={height / 3 - 0.2} y2={height / 3 - 0.2} stroke="var(--border)" strokeWidth="0.3" />
        {data.map((d, i) => {
          const h = (Math.max(0, d.value) / max) * (height / 3 - 4);
          return (
            <rect key={d.label} x={i * barW + barW * 0.15} width={barW * 0.7} y={height / 3 - h} height={h} rx="0.6" fill="var(--primary)">
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
      <figcaption className="sr-only">
        <table>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th>{d.label}</th>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars for ranked lists (top products, tenders). */
export function RankBars({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate">{d.label}</span>
            <span className="tabular shrink-0 font-medium">{format(d.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden>
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(Math.abs(d.value) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
