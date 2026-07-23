import { Button as SpectrumButton } from "@react-spectrum/s2/Button";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  onHoverStart?: () => void;
  onFocus?: () => void;
  "aria-label"?: string;
}

const APPEARANCE = {
  primary: { variant: "accent", fillStyle: "fill" },
  secondary: { variant: "secondary", fillStyle: "fill" },
  danger: { variant: "negative", fillStyle: "fill" }
} as const;

export function Button({
  children,
  variant = "primary",
  type = "button",
  isDisabled,
  isPending,
  autoFocus,
  onPress,
  onHoverStart,
  onFocus,
  "aria-label": ariaLabel
}: ButtonProps) {
  const appearance = APPEARANCE[variant];
  const optionalProps = {
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isPending === undefined ? {} : { isPending }),
    ...(autoFocus === undefined ? {} : { autoFocus }),
    ...(onPress === undefined ? {} : { onPress }),
    ...(onHoverStart === undefined ? {} : { onHoverStart }),
    ...(onFocus === undefined ? {} : { onFocus }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })
  };
  return (
    <SpectrumButton
      {...optionalProps}
      variant={appearance.variant}
      fillStyle={appearance.fillStyle}
      size="S"
      type={type}
    >
      {children}
    </SpectrumButton>
  );
}
