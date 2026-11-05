import { Input } from './input';
import { useState, type ComponentProps } from 'react';
import { commitNumber } from '@/lib/numberInput';

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | string;
  onValueChange: (value: number) => void;
  integer?: boolean;
};

/** Keep the draft verbatim until blur. Clicking Save blurs before its click handler. */
export function NumberInput({ value, onValueChange, integer = false, min, max, onBlur, onKeyDown, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return <Input {...props} type="number"  min={min} max={max}
    inputMode={integer ? 'numeric' : 'decimal'}
    value={draft ?? value}
    onChange={event => setDraft(event.target.value)}
    onBlur={event => {
      if (draft !== null) {
        onValueChange(commitNumber(draft, Number(value) || 0, min, max, integer));
        setDraft(null);
      }
      onBlur?.(event);
    }}
    onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur();
      onKeyDown?.(event);
    }} />;
}
