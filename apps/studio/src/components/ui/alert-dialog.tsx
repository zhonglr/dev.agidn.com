import { ButtonGroup } from "@react-spectrum/s2/ButtonGroup";
import { Content } from "@react-spectrum/s2/Content";
import { Dialog as SpectrumDialog, DialogContainer as SpectrumDialogContainer } from "@react-spectrum/s2/Dialog";
import { Heading } from "@react-spectrum/s2/Heading";
import type { ReactNode } from "react";
import { Button } from "./button.js";

export type AlertDialogVariant = "confirmation" | "danger";

export interface AlertDialogProps {
  isOpen: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  variant?: AlertDialogVariant;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AlertDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel,
  variant = "confirmation",
  isPending = false,
  onConfirm,
  onCancel
}: AlertDialogProps) {
  return (
    <SpectrumDialogContainer onDismiss={onCancel}>
      {isOpen ? (
        <SpectrumDialog role="alertdialog" size="S" isKeyboardDismissDisabled={isPending}>
          <Heading>{title}</Heading>
          <Content>{children}</Content>
          <ButtonGroup>
            <Button variant="secondary" isDisabled={isPending} onPress={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              isPending={isPending}
              autoFocus
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
          </ButtonGroup>
        </SpectrumDialog>
      ) : null}
    </SpectrumDialogContainer>
  );
}
