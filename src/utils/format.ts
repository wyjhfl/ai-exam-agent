export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
