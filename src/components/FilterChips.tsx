import { IonChip } from '@ionic/react';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Single-select filter pills (IonChip). The row scrolls horizontally when the
 * chips don't fit, clipped at the page padding like in the Remesas design.
 */
const FilterChips = <T extends string>({ options, value, onChange, ariaLabel, className = '' }: FilterChipsProps<T>) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <IonChip
          key={option.value}
          role="button"
          // Ionic custom elements: pass ARIA booleans as strings
          aria-pressed={selected ? 'true' : 'false'}
          onClick={() => onChange(option.value)}
          className={`m-0 h-9 shrink-0 rounded-full border border-solid px-4 text-[14px] font-medium ${
            selected ? 'border-tinta bg-tinta text-white' : 'border-line bg-transparent text-tinta'
          }`}
        >
          {option.label}
        </IonChip>
      );
    })}
  </div>
);

export default FilterChips;
