import { useState, useEffect } from "react";

interface ParamCardProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  imgSrc: string;
}

export function ParamCard({ label, value, onChange, imgSrc }: ParamCardProps) {
  const [inputValue, setInputValue] = useState<string>(value.toString());

  // Sincronizar cuando el valor externo cambia
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleChange = (val: string) => {
    setInputValue(val);
    const num = Number(val);
    if (val !== "" && !isNaN(num)) {
      onChange(Math.max(0, num));
    }
  };

  const handleBlur = () => {
    if (inputValue === "" || isNaN(Number(inputValue))) {
      setInputValue("0");
      onChange(0);
    }
  };

  const increment = () => {
    const newVal = value + 1;
    setInputValue(newVal.toString());
    onChange(newVal);
  };

  const decrement = () => {
    const newVal = Math.max(0, value - 1);
    setInputValue(newVal.toString());
    onChange(newVal);
  };

  return (
    <div className="card">
      <img src={imgSrc} alt={label} className="card-img" />
      <div className="card-row">
       <span className="card-label">{label}:</span>
        <input
          className="num-input compact"
          type="number"
          min={0}
          step={1}
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          aria-label={label}
        />
      
      </div>
    </div>
  );
}