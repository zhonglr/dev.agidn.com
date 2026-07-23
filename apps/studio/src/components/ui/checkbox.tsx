import { Checkbox as SpectrumCheckbox } from "@react-spectrum/s2/Checkbox";
import type { ReactNode } from "react";

export interface CheckboxProps {
  label: ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  onChange?: (isSelected: boolean) => void;
}

export function Checkbox({
  label,
  isSelected,
  defaultSelected,
  isIndeterminate,
  isDisabled,
  isRequired,
  onChange
}: CheckboxProps) {
  if (isSelected !== undefined && defaultSelected !== undefined) {
    throw new Error("Checkbox cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(isSelected === undefined ? {} : { isSelected }),
    ...(defaultSelected === undefined ? {} : { defaultSelected }),
    ...(isIndeterminate === undefined ? {} : { isIndeterminate }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isRequired === undefined ? {} : { isRequired }),
    ...(onChange === undefined ? {} : { onChange })
  };

  return (
    <SpectrumCheckbox {...optionalProps} size="S">
      {label}
    </SpectrumCheckbox>
  );
}
