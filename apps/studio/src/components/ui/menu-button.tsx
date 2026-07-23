import { ActionButton as SpectrumActionButton } from "@react-spectrum/s2/ActionButton";
import { Header, Menu, MenuItem, MenuSection, MenuTrigger } from "@react-spectrum/s2/Menu";
import type { ReactNode } from "react";

export interface MenuButtonAction {
  id: string;
  label: string;
  isDisabled?: boolean;
  isSelected?: boolean;
  onAction: () => void;
}

export interface MenuButtonSection {
  id: string;
  label: string;
  actions: readonly MenuButtonAction[];
}

export interface MenuButtonProps {
  label: string;
  trigger: ReactNode;
  sections: readonly MenuButtonSection[];
}

export function MenuButton({ label, trigger, sections }: MenuButtonProps) {
  const actions = sections.flatMap((section) => section.actions);
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const disabledKeys = actions.filter((action) => action.isDisabled).map((action) => action.id);
  const selectedKeys = new Set(actions.filter((action) => action.isSelected).map((action) => action.id));

  return (
    <MenuTrigger>
      <SpectrumActionButton aria-label={label} size="S" isQuiet>
        {trigger}
      </SpectrumActionButton>
      <Menu
        aria-label={label}
        size="S"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        disabledKeys={disabledKeys}
        onAction={(key) => actionsById.get(String(key))?.onAction()}
      >
        {sections.map((section) => (
          <MenuSection id={section.id} key={section.id}>
            <Header>{section.label}</Header>
            {section.actions.map((action) => (
              <MenuItem id={action.id} key={action.id}>
                {action.label}
              </MenuItem>
            ))}
          </MenuSection>
        ))}
      </Menu>
    </MenuTrigger>
  );
}
