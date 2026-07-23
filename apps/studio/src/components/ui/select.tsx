import { Picker as SpectrumPicker, PickerItem } from "@react-spectrum/s2/Picker";
import type { ReactNode } from "react";

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps {
  label: ReactNode;
  options: readonly SelectOption[];
  selectedKey?: string | null;
  defaultSelectedKey?: string;
  placeholder?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  isDisabled?: boolean;
  isRequired?: boolean;
  onSelectionChange?: (key: string) => void;
}

export function Select({
  label,
  options,
  selectedKey,
  defaultSelectedKey,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  onSelectionChange
}: SelectProps) {
  if (selectedKey !== undefined && defaultSelectedKey !== undefined) {
    throw new Error("Select cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(selectedKey === undefined ? {} : { selectedKey }),
    ...(defaultSelectedKey === undefined ? {} : { defaultSelectedKey }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(description === undefined ? {} : { description }),
    ...(errorMessage === undefined ? {} : { errorMessage }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isRequired === undefined ? {} : { isRequired }),
    ...(onSelectionChange === undefined ? {} : {
      onSelectionChange: (key: React.Key | null) => {
        if (key !== null) onSelectionChange(String(key));
      }
    })
  };

  return (
    <SpectrumPicker {...optionalProps} label={label} labelPosition="side" size="S">
      {options.map((option) => (
        <PickerItem id={option.id} key={option.id}>{option.label}</PickerItem>
      ))}
    </SpectrumPicker>
  );
}
