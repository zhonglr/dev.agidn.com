import { TextField as SpectrumTextField } from "@react-spectrum/s2/TextField";
import type { ReactNode } from "react";

export interface TextFieldProps {
  label: ReactNode;
  name?: string;
  type?: "text" | "email" | "password" | "url" | "search";
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onSubmit?: () => void;
}

export function TextField({
  label,
  name,
  type = "text",
  value,
  defaultValue,
  placeholder,
  description,
  errorMessage,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  autoComplete,
  autoFocus,
  onChange,
  onBlur,
  onSubmit
}: TextFieldProps) {
  if (value !== undefined && defaultValue !== undefined) {
    throw new Error("TextField cannot be both controlled and uncontrolled.");
  }

  const resolvedIsInvalid = isInvalid ?? errorMessage !== undefined;
  const optionalProps = {
    ...(name === undefined ? {} : { name }),
    ...(value === undefined ? {} : { value }),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(description === undefined ? {} : { description }),
    ...(errorMessage === undefined ? {} : { errorMessage }),
    ...(isRequired === undefined ? {} : { isRequired }),
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isReadOnly === undefined ? {} : { isReadOnly }),
    ...(resolvedIsInvalid ? { isInvalid: true } : {}),
    ...(autoComplete === undefined ? {} : { autoComplete }),
    ...(autoFocus === undefined ? {} : { autoFocus }),
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
    <SpectrumTextField
      {...optionalProps}
      label={label}
      type={type}
      labelPosition="top"
      size="S"
      UNSAFE_style={{ width: "100%" }}
    />
  );
}
