// src/components/ParamCheckbox.tsx
import { useState, useEffect } from "react";

interface ParamCheckboxProps {
  label: string;
  value: number;               // 0/1 para compatibilidad con Params
  onChange: (value: number) => void;
  imgSrc: string;
}

export function ParamCheckbox({ label, value, onChange, imgSrc }: ParamCheckboxProps) {
  const [checked, setChecked] = useState<boolean>(Boolean(value));

  useEffect(() => {
    setChecked(Boolean(value));
  }, [value]);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setChecked(next);
    onChange(next ? 1 : 0);
  };

  return (
    <div className="card">
      <img src={imgSrc} alt={label} className="card-img" />
      <div className="card-row">
        <span className="card-label">{label}:</span>
        <input
          type="checkbox"
          className="checkbox-input"
          checked={checked}
          onChange={handleToggle}
          aria-label={label}
        />
      </div>
    </div>
  );
}