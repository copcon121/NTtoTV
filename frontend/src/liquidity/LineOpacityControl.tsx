import "./LineOpacityControl.css";

export function LineOpacityControl({ value, onChange }: {
  value: number;
  onChange: (opacity: number) => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label className="liquidity-line-opacity" title="0%: hide lines; 100%: default; 200%: twice the intensity">
      <span>Line intensity</span>
      <input
        type="range"
        aria-label="Liquidity line intensity"
        aria-valuetext={`${percent}%`}
        min={0}
        max={200}
        step={5}
        value={percent}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber / 100)}
      />
      <output>{percent}%</output>
    </label>
  );
}
