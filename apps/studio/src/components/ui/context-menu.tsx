import {
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  SubmenuTrigger,
  Text
} from "@react-spectrum/s2/Menu";
import { Popover } from "@react-spectrum/s2/Popover";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode
} from "react";
import {
  type ContextMenuItemDescriptor,
  type ContextMenuRegistry,
  type ContextMenuSectionDescriptor,
  type ContextMenuTarget
} from "../../context-menu/registry.js";

interface ContextMenuState {
  x: number;
  y: number;
  label: string;
  sections: readonly ContextMenuSectionDescriptor[];
  returnFocusTo?: HTMLElement;
}

interface ContextMenuValue {
  openContextMenu: (event: MouseEvent<HTMLElement>, target: ContextMenuTarget) => void;
  openContextMenuAt: (
    point: { x: number; y: number },
    target: ContextMenuTarget,
    returnFocusTo?: HTMLElement
  ) => void;
  closeContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuValue | undefined>(undefined);

function runItem(item: ContextMenuItemDescriptor, close: () => void): void {
  if (!item.execute || item.isDisabled) return;
  close();
  void Promise.resolve()
    .then(item.execute)
    .catch((error: unknown) => console.error("Context menu action failed", error));
}

function itemContent(item: ContextMenuItemDescriptor): ReactNode {
  return (
    <>
      {item.icon}
      <Text slot="label">{item.label}</Text>
      {item.description ? <Text slot="description">{item.description}</Text> : null}
      {item.keyboard ? <Keyboard>{item.keyboard}</Keyboard> : null}
    </>
  );
}

function renderItem(item: ContextMenuItemDescriptor, close: () => void): ReactNode {
  if (item.children?.length) {
    return (
      <SubmenuTrigger key={item.id}>
        <MenuItem
          id={item.id}
          textValue={item.label}
          {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
        >
          {itemContent(item)}
        </MenuItem>
        <Menu aria-label={item.label} size="S">
          {item.children.map((child) => renderItem(child, close))}
        </Menu>
      </SubmenuTrigger>
    );
  }
  return (
    <MenuItem
      id={item.id}
      key={item.id}
      textValue={item.label}
      {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
      onAction={() => runItem(item, close)}
    >
      {itemContent(item)}
    </MenuItem>
  );
}

function collectSelectedKeys(items: readonly ContextMenuItemDescriptor[], result: string[] = []): string[] {
  for (const item of items) {
    if (item.isSelected) result.push(item.id);
    if (item.children?.length) collectSelectedKeys(item.children, result);
  }
  return result;
}

function menuItems(
  sections: readonly ContextMenuSectionDescriptor[],
  close: () => void
): ReactNode {
  if (sections.length === 1) {
    return sections[0]!.items.map((item) => renderItem(item, close));
  }
  return sections.map((section) => (
    <MenuSection id={section.id} key={section.id} aria-label={section.label}>
      {section.items.map((item) => renderItem(item, close))}
    </MenuSection>
  ));
}

export function ContextMenuProvider({
  registry,
  onOpenChange,
  children
}: {
  registry: ContextMenuRegistry;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<ContextMenuState>();
  const stateRef = useRef(state);
  stateRef.current = state;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const closeContextMenu = useCallback(() => {
    const returnFocusTo = stateRef.current?.returnFocusTo;
    setState(undefined);
    onOpenChangeRef.current?.(false);
    requestAnimationFrame(() => {
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    });
  }, []);

  const openContextMenuAt = useCallback(
    (
      point: { x: number; y: number },
      target: ContextMenuTarget,
      returnFocusTo?: HTMLElement
    ): void => {
      const sections = registry.resolve(target);
      if (!sections.length) return;
      setState({
        x: point.x,
        y: point.y,
        label: target.label ?? target.type,
        sections,
        ...(returnFocusTo ? { returnFocusTo } : {})
      });
      onOpenChangeRef.current?.(true);
    },
    [registry]
  );

  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>, target: ContextMenuTarget): void => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenuAt(
        {
          x: event.clientX || rect.left + Math.min(24, rect.width / 2),
          y: event.clientY || rect.top + Math.min(20, rect.height / 2)
        },
        target,
        event.currentTarget
      );
    },
    [openContextMenuAt]
  );

  const selectedKeys = useMemo(
    () => (state ? collectSelectedKeys(state.sections.flatMap((section) => section.items)) : []),
    [state]
  );

  return (
    <ContextMenuContext.Provider value={{ openContextMenu, openContextMenuAt, closeContextMenu }}>
      {children}
      {state ? (
        <>
          <span
            ref={anchorRef}
            aria-hidden="true"
            className="context-menu-anchor"
            style={{ position: "fixed", left: state.x, top: state.y }}
          />
          <Popover
            triggerRef={anchorRef}
            isOpen
            placement="bottom start"
            offset={2}
            crossOffset={0}
            shouldFlip
            hideArrow
            onOpenChange={(isOpen) => {
              if (!isOpen) closeContextMenu();
            }}
          >
            <Menu
              aria-label={state.label}
              size="S"
              autoFocus
              {...(selectedKeys.length
                ? {
                    selectionMode: "multiple" as const,
                    selectedKeys,
                    onSelectionChange: () => undefined
                  }
                : {})}
            >
              {menuItems(state.sections, closeContextMenu)}
            </Menu>
          </Popover>
        </>
      ) : null}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu(): ContextMenuValue {
  const value = useContext(ContextMenuContext);
  if (!value) throw new Error("useContextMenu must be used inside ContextMenuProvider.");
  return value;
}
