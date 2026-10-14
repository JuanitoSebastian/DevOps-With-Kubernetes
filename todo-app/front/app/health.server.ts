let isHealthy = true;

export function checkHealth(): boolean {
  return isHealthy;
}

export function breakApp(): void {
  isHealthy = false;
}
