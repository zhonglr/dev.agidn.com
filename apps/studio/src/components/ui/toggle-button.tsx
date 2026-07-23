import { ToggleButton as SpectrumToggleButton } from "@react-spectrum/s2/ToggleButton";
import type { ReactNode } from "react";

export interface ToggleButtonProps {
  children: ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  onChange?: (isSelected: boolean) => void;
  "aria-controls"?: string;
  "aria-label"?: string;
}

export function ToggleButton({
  children,
  isSelected,
  defaultSelected,
  isDisabled,
  onChange,
  "aria-controls": ariaControls,
  "aria-label": ariaLabel
}: ToggleButtonProps) {
  if (isSelected !== undefined && defaultSelected !== undefined) {
    throw new Error("ToggleButton cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(isSelected === undefined ? {} : { isSelected }),
    ...(defaultSelected === undefined ? {} : { defaultSelected }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(onChange === undefined ? {} : { onChange }),
    ...(ariaControls === undefined ? {} : { "aria-controls": ariaControls }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })
  };

  return (
    <SpectrumToggleButton {...optionalProps} size="S" isQuiet>
      {children}
    </SpectrumToggleButton>
  );
}
