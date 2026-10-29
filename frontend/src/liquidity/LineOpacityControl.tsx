import "./LineOpacityControl.css";

export function LineOpacityControl({ value, onChange }: {
  value: number;
  onChange: (opacity: number) => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label className="liquidity-line-opacity" title="0%: ẩn line; 100%: mặc định; 200%: đậm gấp đôi">
      <span>Độ đậm line</span>
      <input
        type="range"
        aria-label="Độ đậm line thanh khoản"
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
