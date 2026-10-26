/**
 * Pick the highest-priority active margin rule that matches the project.
 * Explicit input.marginPercent always wins when provided (including 0).
 */

function matches(rule, ctx) {
  if (rule.active === false) return false;
  if (rule.projectType && rule.projectType !== '*' && rule.projectType.toLowerCase() !== ctx.projectType.toLowerCase()) return false;
  if (rule.quality && rule.quality !== '*' && rule.quality.toLowerCase() !== ctx.quality.toLowerCase()) return false;
  if (rule.projectSize && rule.projectSize !== 'any' && rule.projectSize !== ctx.projectSize) return false;
  if (ctx.coveredArea < (rule.minCoveredArea || 0)) return false;
  if (rule.maxCoveredArea != null && ctx.coveredArea > rule.maxCoveredArea) return false;
  if (ctx.floors < (rule.minFloors || 1)) return false;
  if (rule.maxFloors != null && ctx.floors > rule.maxFloors) return false;
  return true;
}

export function projectSizeBand(builtUpSqFt) {
  if (builtUpSqFt < 1500) return 'small';
  if (builtUpSqFt < 4500) return 'medium';
  return 'large';
}

export function resolveMarginPercent(input = {}, rules = [], fallbackPercent = 0) {
  const wantsAuto = input.autoMargin === true || input.marginPercent === 'auto';
  if (!wantsAuto && input.marginPercent !== undefined && input.marginPercent !== '' && input.marginPercent !== null) {
    return {
      marginPercent: Number(input.marginPercent),
      source: 'Manual margin percent from estimate form',
      matchedRule: null,
    };
  }

  const covered = Number(input.coveredAreaSqFt || input.builtUpSqFt || 0);
  const floors = Number(input.floors) || 1;
  const ctx = {
    projectType: String(input.projectType || input.buildingType || 'House'),
    quality: String(input.quality || 'standard'),
    coveredArea: covered,
    floors,
    projectSize: input.projectSize || projectSizeBand(covered * floors),
  };

  const sorted = [...(rules || [])]
    .filter((rule) => rule.active !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const rule of sorted) {
    if (matches(rule, ctx)) {
      return {
        marginPercent: Number(rule.marginPercent) || 0,
        source: `Margin rule “${rule.name}” (priority ${rule.priority ?? 100})`,
        matchedRule: {
          id: rule._id || rule.id || null,
          name: rule.name,
          priority: rule.priority,
          marginPercent: rule.marginPercent,
        },
      };
    }
  }

  return {
    marginPercent: Number(fallbackPercent) || 0,
    source: 'Default margin from rate-book settings',
    matchedRule: null,
  };
}
