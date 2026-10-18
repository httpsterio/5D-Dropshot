<script lang="ts">
  import type { EloPoint } from '../lib/eloHistory';

  interface Props { points: EloPoint[]; }
  let { points }: Props = $props();

  // Vertical plot band in the normalised (0-100) viewBox.
  const TOP = 10;
  const BOTTOM = 90;

  const chart = $derived.by(() => {
    // Only the start point (0 matches) means there is nothing to plot.
    if (points.length < 2) return null;

    const values = points.map((p) => p.elo);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max === min) {
      min -= 8;
      max += 8;
    }

    const yOf = (elo: number) => TOP + (1 - (elo - min) / (max - min)) * (BOTTOM - TOP);
    const first = points[0].endedAt;
    const last = points[points.length - 1].endedAt;
    // One equal step per match, not time-proportional: the gaps between playing days
    // are uneven, so a date axis would squash clustered matches into a sliver.
    const xOf = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * 100 : 50);

    const vertices = points.map((p, i) => ({ ...p, x: xOf(i), y: yOf(p.elo) }));
    const line = vertices.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
    const midElo = Math.round((min + max) / 2);

    return {
      vertices,
      dots: vertices.slice(1),
      // A lone match has no span, so draw just its dot rather than the initial segment.
      showPath: vertices.length > 2,
      line,
      area: `0,${BOTTOM} ${line} 100,${BOTTOM}`,
      min: Math.round(min),
      max: Math.round(max),
      midElo,
      yMin: yOf(min),
      yMid: yOf(midElo),
      yMax: yOf(max),
      firstElo: points[0].elo,
      lastElo: points[points.length - 1].elo,
      lastY: vertices[vertices.length - 1].y,
      count: points.length - 1,
      firstDate: first,
      lastDate: last
    };
  });

  const label = $derived(
    chart
      ? `Elo over ${chart.count} ${chart.count === 1 ? 'match' : 'matches'}, ${Math.round(chart.firstElo)} to ${Math.round(chart.lastElo)}`
      : 'Elo chart'
  );

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

{#if chart}
  <div class="relative w-full h-32" role="img" aria-label={label}>
    <svg
      class="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {#if chart.showPath}
        <polygon points={chart.area} class="text-primary" fill="currentColor" fill-opacity="0.1" />
      {/if}
      {#each [chart.yMax, chart.yMid, chart.yMin] as gy}
        <line x1="0" y1={gy} x2="100" y2={gy} class="text-base-content" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" vector-effect="non-scaling-stroke" />
      {/each}
      {#if chart.showPath}
        <polyline points={chart.line} fill="none" class="text-primary" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      {/if}
    </svg>

    <span class="absolute left-0 -translate-y-1/2 text-[10px] tabular text-base-content/40" style="top: {chart.yMax}%">{chart.max}</span>
    <span class="absolute left-0 -translate-y-1/2 text-[10px] tabular text-base-content/40" style="top: {chart.yMid}%">{chart.midElo}</span>
    <span class="absolute left-0 -translate-y-1/2 text-[10px] tabular text-base-content/40" style="top: {chart.yMin}%">{chart.min}</span>
    <span class="absolute right-0 -translate-y-1/2 text-[10px] tabular font-semibold text-base-content/70" style="top: {chart.lastY}%">{Math.round(chart.lastElo)}</span>

    {#each chart.dots as v (v.matchId)}
      <span
        class="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full {v.result === 'win' ? 'bg-success' : v.result === 'loss' ? 'bg-error' : 'bg-base-content/40'}"
        style="left: {v.x}%; top: {v.y}%"
      ></span>
    {/each}
  </div>

  <div class="flex justify-between text-[10px] text-base-content/40 px-0.5">
    <span>{fmtDate(chart.firstDate)}</span>
    {#if chart.lastDate !== chart.firstDate}
      <span>{fmtDate(chart.lastDate)}</span>
    {/if}
  </div>
{/if}
