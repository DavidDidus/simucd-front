type ProgressBarProps = {
  value: number;      // 0 - 100
  label?: string;
};

export default function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="progress-container">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
