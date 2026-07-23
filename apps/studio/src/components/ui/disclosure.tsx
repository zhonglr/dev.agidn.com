import {
  Disclosure as SpectrumDisclosure,
  DisclosurePanel as SpectrumDisclosurePanel,
  DisclosureTitle as SpectrumDisclosureTitle
} from "@react-spectrum/s2/Disclosure";
import type { ReactNode } from "react";

export interface DisclosureProps {
  title: ReactNode;
  children: ReactNode;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
}

export function Disclosure({ title, children, isExpanded, defaultExpanded, onExpandedChange }: DisclosureProps) {
  if (isExpanded !== undefined && defaultExpanded !== undefined) {
    throw new Error("Disclosure cannot be both controlled and uncontrolled.");
  }

  const optionalProps = {
    ...(isExpanded === undefined ? {} : { isExpanded }),
    ...(defaultExpanded === undefined ? {} : { defaultExpanded }),
    ...(onExpandedChange === undefined ? {} : { onExpandedChange })
  };

  return (
    <SpectrumDisclosure {...optionalProps} size="S" density="compact" isQuiet>
      <SpectrumDisclosureTitle level={3}>{title}</SpectrumDisclosureTitle>
      <SpectrumDisclosurePanel>{children}</SpectrumDisclosurePanel>
    </SpectrumDisclosure>
  );
}
