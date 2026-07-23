import { SearchField as SpectrumSearchField } from "@react-spectrum/s2/SearchField";

export interface SearchFieldProps {
  label: string;
  isLabelHidden?: boolean;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  onEscape?: () => void;
}

export function SearchField({
  label,
  isLabelHidden = false,
  value,
  defaultValue,
  placeholder,
  isDisabled,
  isReadOnly,
  autoFocus,
  onChange,
  onSubmit,
  onClear,
  onEscape
}: SearchFieldProps) {
  if (value !== undefined && defaultValue !== undefined) {
    throw new Error("SearchField cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(value === undefined ? {} : { value }),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isReadOnly === undefined ? {} : { isReadOnly }),
    ...(autoFocus === undefined ? {} : { autoFocus }),
    ...(onChange === undefined ? {} : { onChange }),
    ...(onSubmit === undefined ? {} : { onSubmit }),
    ...(onClear === undefined ? {} : { onClear }),
    ...(onEscape === undefined ? {} : {
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Escape") onEscape();
      }
    })
  };

  return (
    <SpectrumSearchField
      {...optionalProps}
      {...(isLabelHidden ? { "aria-label": label } : { label })}
      size="M"
    />
  );
}
