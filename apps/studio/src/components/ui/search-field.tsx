import { SearchField as SpectrumSearchField } from "@react-spectrum/s2/SearchField";

export interface SearchFieldProps {
  label: string;
  size?: "S" | "M" | "L" | "XL";
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
  "aria-controls"?: string;
  "aria-activedescendant"?: string;
}

export function SearchField({
  label,
  size = "S",
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
  onEscape,
  "aria-controls": ariaControls,
  "aria-activedescendant": ariaActiveDescendant
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
    ...(onEscape === undefined
      ? {}
      : {
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Escape") onEscape();
          }
        }),
    ...(ariaControls === undefined ? {} : { "aria-controls": ariaControls }),
    ...(ariaActiveDescendant === undefined ? {} : { "aria-activedescendant": ariaActiveDescendant })
  };

  return (
    <SpectrumSearchField
      {...optionalProps}
      {...(isLabelHidden ? { "aria-label": label } : { label })}
      size={size}
      UNSAFE_style={{ width: "100%" }}
    />
  );
}
