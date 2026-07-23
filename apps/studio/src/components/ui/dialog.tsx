import { ButtonGroup } from "@react-spectrum/s2/ButtonGroup";
import { Content } from "@react-spectrum/s2/Content";
import { Dialog as SpectrumDialog, DialogContainer as SpectrumDialogContainer } from "@react-spectrum/s2/Dialog";
import { Heading } from "@react-spectrum/s2/Heading";
import type { ReactNode } from "react";

export type DialogSize = "small" | "medium" | "large" | "extra-large";

export interface DialogProps {
  isOpen: boolean;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: DialogSize;
  isDismissible?: boolean;
  isKeyboardDismissDisabled?: boolean;
  onDismiss: () => void;
}

const SIZE_MAP = {
  small: "S",
  medium: "M",
  large: "L",
  "extra-large": "XL"
} as const;

export function Dialog({
  isOpen,
  title,
  children,
  actions,
  size = "medium",
  isDismissible = actions === undefined,
  isKeyboardDismissDisabled,
  onDismiss
}: DialogProps) {
  if (isDismissible && actions !== undefined) {
    throw new Error("Dismissible dialogs cannot declare an action group.");
  }

  return (
    <SpectrumDialogContainer onDismiss={onDismiss}>
      {isOpen ? (
        <SpectrumDialog
          size={SIZE_MAP[size]}
          isDismissible={isDismissible}
          {...(isKeyboardDismissDisabled === undefined ? {} : { isKeyboardDismissDisabled })}
        >
          <Heading>{title}</Heading>
          <Content>{children}</Content>
          {actions === undefined ? null : <ButtonGroup>{actions}</ButtonGroup>}
        </SpectrumDialog>
      ) : null}
    </SpectrumDialogContainer>
  );
}
