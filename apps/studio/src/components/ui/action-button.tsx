import { ActionButton as SpectrumActionButton } from "@react-spectrum/s2/ActionButton";
import { forwardRef, type AriaRole, type ReactNode } from "react";

export interface ActionButtonProps {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  onHoverStart?: () => void;
  onFocus?: () => void;
  className?: string;
  role?: AriaRole;
  "aria-selected"?: boolean;
  "aria-label"?: string;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  {
    children,
    type = "button",
    isDisabled,
    isPending,
    autoFocus,
    onPress,
    onHoverStart,
    onFocus,
    className,
    role,
    "aria-selected": ariaSelected,
    "aria-label": ariaLabel
  },
  ref
) {
  const optionalProps = {
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isPending === undefined ? {} : { isPending }),
    ...(autoFocus === undefined ? {} : { autoFocus }),
    ...(onPress === undefined ? {} : { onPress }),
    ...(onHoverStart === undefined ? {} : { onHoverStart }),
    ...(onFocus === undefined ? {} : { onFocus }),
    ...(className === undefined ? {} : { UNSAFE_className: className }),
    ...(role === undefined ? {} : { role }),
    ...(ariaSelected === undefined ? {} : { "aria-selected": ariaSelected }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })
  };

  return (
    <SpectrumActionButton
      {...optionalProps}
      ref={(value) => {
        const button = value?.UNSAFE_getDOMNode() ?? null;
        if (typeof ref === "function") ref(button);
        else if (ref) ref.current = button;
      }}
      type={type}
      size="S"
      isQuiet
    >
      {children}
    </SpectrumActionButton>
  );
});
