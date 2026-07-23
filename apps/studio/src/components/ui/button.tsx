import { Button as SpectrumButton } from "@react-spectrum/s2/Button";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
}

const APPEARANCE = {
  primary: { variant: "accent", fillStyle: "fill" },
  secondary: { variant: "secondary", fillStyle: "fill" },
  danger: { variant: "negative", fillStyle: "fill" },
  quiet: { variant: "primary", fillStyle: "outline" }
} as const;

export function Button({
  children,
  variant = "primary",
  type = "button",
  isDisabled,
  isPending,
  autoFocus,
  onPress,
  "aria-label": ariaLabel
}: ButtonProps) {
  const appearance = APPEARANCE[variant];
  const optionalProps = {
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isPending === undefined ? {} : { isPending }),
    ...(autoFocus === undefined ? {} : { autoFocus }),
    ...(onPress === undefined ? {} : { onPress }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })
  };
  return (
    <SpectrumButton
      {...optionalProps}
      variant={appearance.variant}
      fillStyle={appearance.fillStyle}
      type={type}
    >
      {children}
    </SpectrumButton>
  );
}
