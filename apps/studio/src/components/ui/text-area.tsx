import { TextArea as SpectrumTextArea } from "@react-spectrum/s2/TextArea";
import type { ReactNode } from "react";

export interface TextAreaProps {
  label: ReactNode;
  value?: string;
  defaultValue?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}

export function TextArea({
  label,
  value,
  defaultValue,
  isRequired,
  isDisabled,
  isInvalid,
  onChange,
  onBlur
}: TextAreaProps) {
  if (value !== undefined && defaultValue !== undefined)
    throw new Error("TextArea cannot be both controlled and uncontrolled.");
  return (
    <SpectrumTextArea
      label={label}
      labelPosition="top"
      size="S"
      UNSAFE_style={{ width: "100%" }}
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(isRequired === undefined ? {} : { isRequired })}
      {...(isDisabled === undefined ? {} : { isDisabled })}
      {...(isInvalid === undefined ? {} : { isInvalid })}
      {...(onChange === undefined ? {} : { onChange })}
      {...(onBlur === undefined ? {} : { onBlur })}
    />
  );
}
