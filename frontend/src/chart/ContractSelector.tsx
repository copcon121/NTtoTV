export interface ContractSelectorProps {
  value?: string;
  contracts: readonly string[];
  disabled?: boolean;
  onChange: (contract: string) => void;
}

export function ContractSelector({
  value,
  contracts,
  disabled = false,
  onChange,
}: ContractSelectorProps) {
  const selectValue = value ?? "";
  const options = value && !contracts.includes(value) ? [value, ...contracts] : contracts;

  return (
    <label className="contract-selector">
      <span className="contract-selector-label">Contract</span>
      <select
        aria-label="Contract selector"
        value={selectValue}
        disabled={disabled || options.length === 0}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next && next !== value) {
            onChange(next);
          }
        }}
      >
        {value === undefined && <option value="">Loading</option>}
        {options.map((contract) => (
          <option key={contract} value={contract}>
            {contract}
          </option>
        ))}
      </select>
    </label>
  );
}
