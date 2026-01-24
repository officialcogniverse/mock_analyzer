export const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
};

export const formatPercent = (value: number) => `${value}%`;

export const formatDelta = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
