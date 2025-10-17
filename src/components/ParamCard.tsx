import React from "react";

type CardProps = {
  label: string;
  value: number;
  onChange: (val: number) => void;
  imgSrc?: string;
};

export const ParamCard: React.FC<CardProps> = ({
  label,
  value,
  onChange,
  imgSrc,
}) => {
  return (
    <div className="card">
      {imgSrc && <img src={imgSrc} alt={label} className="card-img" />}
      <div className="card-row">
        <span className="card-label">{label}:</span>
        <input
          className="num-input compact"
          type="number"
          min={0}
          step={1}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          aria-label={label}
        />
      </div>
    </div>
  );
};
