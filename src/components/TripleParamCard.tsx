import { useState, useEffect } from "react";

interface TripleParamCardProps {
  labels: [string, string, string];
  values: [number, number, number];
  onChange: (index: number, value: number) => void;
  imgSrc?: string;
}

export default function TripleParamCard({
  labels,
  values,
  onChange,
  imgSrc,
}: TripleParamCardProps) {
  const [inputs, setInputs] = useState<string[]>(values.map((v) => v?.toString()));

  useEffect(() => {
    setInputs(values.map((v) => v?.toString()));
  }, [values]);

  const handleChange = (idx: number, val: string) => {
    const newInputs = [...inputs];
    newInputs[idx] = val;
    setInputs(newInputs);
    const num = Number(val);
    if (val !== "" && !isNaN(num)) {
      onChange(idx, Math.max(0, num));
    }
  };

  const handleBlur = (idx: number) => {
    if (inputs[idx] === "" || isNaN(Number(inputs[idx]))) {
      const newInputs = [...inputs];
      newInputs[idx] = "0";
      setInputs(newInputs);
      onChange(idx, 0);
    }
  };

  return (
    <div className="card triple-card">
      {imgSrc && <img src={imgSrc} alt={labels[0]} className="card-img" />}
      <div className="card-row">
        <div className="triple-inputs">
          {labels.map((lab, i) => (
            <label key={i} className="triple-field">
              <span className="card-label">{lab}:</span>
              <input
                className="num-input compact"
                type="number"
                min={0}
                step={1}
                value={inputs[i]}
                onChange={(e) => handleChange(i, e.target.value)}
                onBlur={() => handleBlur(i)}
                aria-label={`${lab}-${i}`}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}