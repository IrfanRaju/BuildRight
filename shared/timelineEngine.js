/** Indicative construction schedule — not a CPM programme or contractual programme. */

const DEFAULT_PHASES = [
  { key: 'foundation', label: 'Foundation', shareOfDuration: 0.18, canOverlapPrev: false, overlapRatio: 0 },
  { key: 'structure', label: 'Structure', shareOfDuration: 0.32, canOverlapPrev: true, overlapRatio: 0.15 },
  { key: 'roofing', label: 'Roofing', shareOfDuration: 0.12, canOverlapPrev: true, overlapRatio: 0.1 },
  { key: 'electrical', label: 'Electrical', shareOfDuration: 0.12, canOverlapPrev: true, overlapRatio: 0.35 },
  { key: 'plumbing', label: 'Plumbing', shareOfDuration: 0.1, canOverlapPrev: true, overlapRatio: 0.4 },
  { key: 'finishing', label: 'Finishing', shareOfDuration: 0.16, canOverlapPrev: true, overlapRatio: 0.2 },
];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.round(days));
  return next;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {{ coveredAreaSqFt: number, floors: number, category: string, quality: string, buildingType?: string, constructionMethod?: string, startDate?: string, workforceFactor?: number, timelineFactor?: number, phases?: array }} input
 */
export function predictTimeline(input = {}) {
  const floors = Math.max(1, Number(input.floors) || 1);
  const covered = Math.max(100, Number(input.coveredAreaSqFt) || 1000);
  const category = String(input.category || 'turnkey').toLowerCase();
  const quality = String(input.quality || 'standard').toLowerCase();
  const workforce = Number(input.workforceFactor) > 0 ? Number(input.workforceFactor) : 1;
  const templateFactor = Number(input.timelineFactor) > 0 ? Number(input.timelineFactor) : 1;

  let monthsBase = category.includes('grey') ? 2 + floors * 1.4
    : category.includes('finish') ? 1.2 + floors * 0.8
      : 3 + floors * 1.8;
  monthsBase *= 1 + Math.log10(covered / 1000) * 0.08;
  const qualityBump = quality === 'luxury' ? 1.15 : quality === 'premium' ? 1.08 : quality === 'economy' ? 0.92 : 1;
  const methodBump = String(input.constructionMethod || '').toLowerCase().includes('precast') ? 0.85 : 1;
  const totalMonths = Math.round(monthsBase * qualityBump * methodBump * templateFactor / workforce * 10) / 10;
  const totalDays = Math.max(21, Math.round(totalMonths * 30));

  const phasesSpec = (input.phases?.length ? input.phases : DEFAULT_PHASES)
    .map((phase) => ({
      key: phase.key,
      label: phase.label || phase.key,
      shareOfDuration: Number(phase.shareOfDuration) || 0.1,
      canOverlapPrev: Boolean(phase.canOverlapPrev),
      overlapRatio: Math.min(0.6, Math.max(0, Number(phase.overlapRatio) || 0)),
    }));

  const shareSum = phasesSpec.reduce((sum, phase) => sum + phase.shareOfDuration, 0) || 1;
  const start = input.startDate ? new Date(input.startDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;

  const schedule = [];
  let cursorDay = 0;
  let previousEnd = 0;
  for (const phase of phasesSpec) {
    const durationDays = Math.max(3, Math.round((phase.shareOfDuration / shareSum) * totalDays));
    let phaseStart = cursorDay;
    if (phase.canOverlapPrev && schedule.length) {
      phaseStart = Math.max(0, previousEnd - Math.round(durationDays * phase.overlapRatio));
    }
    const phaseEnd = phaseStart + durationDays;
    const entry = {
      key: phase.key,
      label: phase.label,
      durationDays,
      startOffsetDays: phaseStart,
      endOffsetDays: phaseEnd,
      overlapsPrevious: phase.canOverlapPrev && phaseStart < previousEnd,
    };
    if (validStart) {
      entry.startDate = iso(addDays(validStart, phaseStart));
      entry.endDate = iso(addDays(validStart, phaseEnd));
    }
    schedule.push(entry);
    cursorDay = phaseEnd;
    previousEnd = phaseEnd;
  }

  const calendarEndOffset = schedule.reduce((max, phase) => Math.max(max, phase.endOffsetDays), 0);

  return {
    estimateLabel: 'Indicative construction timeline estimate',
    totalMonths,
    totalDays: calendarEndOffset,
    timelineLabel: `${totalMonths} months (indicative)`,
    startDate: validStart ? iso(validStart) : null,
    completionDate: validStart ? iso(addDays(validStart, calendarEndOffset)) : null,
    phases: schedule,
    assumptions: [
      'Phase durations share an indicative total and allow limited overlap; this is not a critical-path programme.',
      'Workforce and construction-method factors scale the whole schedule uniformly.',
      'Weather, approvals, and material lead times are not modelled.',
    ],
  };
}
