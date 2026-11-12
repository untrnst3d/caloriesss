export function getDayProgress(target, eaten) {
  if (!Number.isFinite(target) || target <= 0) return null;
  const consumed = Math.round(Math.max(0, eaten) * 10) / 10;
  return {
    target, eaten: consumed,
    remaining: Math.round((target - consumed) * 10) / 10,
    percent: Math.min(100, Math.round(consumed / target * 100)),
  };
}
