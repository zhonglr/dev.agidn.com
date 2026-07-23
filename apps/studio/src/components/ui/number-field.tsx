import { NumberField as SpectrumNumberField } from "@react-spectrum/s2/NumberField";
import type { ReactNode } from "react";

export interface NumberFieldProps {
  label: ReactNode;
  value?: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  hideStepper?: boolean;
  onChange?: (value: number) => void;
  onBlur?: () => void;
  onSubmit?: () => void;
}

export function NumberField({
  label,
  value,
  defaultValue,
  minValue,
  maxValue,
  step,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  hideStepper,
  onChange,
  onBlur,
  onSubmit
}: NumberFieldProps) {
  if (value !== undefined && defaultValue !== undefined) {
    throw new Error("NumberField cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(value === undefined ? {} : { value }),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(minValue === undefined ? {} : { minValue }),
    ...(maxValue === undefined ? {} : { maxValue }),
    ...(step === undefined ? {} : { step }),
    ...(isRequired === undefined ? {} : { isRequired }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isReadOnly === undefined ? {} : { isReadOnly }),
    ...(isInvalid === undefined ? {} : { isInvalid }),
    ...(hideStepper === undefined ? {} : { hideStepper }),
    ...(onChange === undefined ? {} : { onChange }),
    ...(onBlur === undefined ? {} : { onBlur }),
    ...(onSubmit === undefined
      ? {}
      : {
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Enter") onSubmit();
          }
        })
  };

  return (
    <SpectrumNumberField
      {...optionalProps}
      label={label}
      labelPosition="side"
      size="S"
      UNSAFE_style={{ width: "100%" }}
    />
  );
}
