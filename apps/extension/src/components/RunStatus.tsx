interface RunStatusProps {
  busy: boolean;
  error: string | null;
}

export function RunStatus({ busy, error }: RunStatusProps) {
  if (busy) return <p class="run-status running" role="status">Searching…</p>;
  if (error) return <p class="run-status error" role="alert">{error}</p>;
  return null;
}
