import { forwardRef, type ReactNode } from "react";
import { ActionButton } from "./action-button.js";

export interface IconButtonProps {
  icon: ReactNode;
  label: string;
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  onHoverStart?: () => void;
  onFocus?: () => void;
  className?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, isDisabled, isPending, autoFocus, onPress, onHoverStart, onFocus, className },
  ref
) {
  return (
    <ActionButton
      ref={ref}
      aria-label={label}
      {...(className === undefined ? {} : { className })}
      {...(isDisabled === undefined ? {} : { isDisabled })}
      {...(isPending === undefined ? {} : { isPending })}
      {...(autoFocus === undefined ? {} : { autoFocus })}
      {...(onPress === undefined ? {} : { onPress })}
      {...(onHoverStart === undefined ? {} : { onHoverStart })}
      {...(onFocus === undefined ? {} : { onFocus })}
    >
      {icon}
    </ActionButton>
  );
});
