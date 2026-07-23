import { ActionButton as SpectrumActionButton } from "@react-spectrum/s2/ActionButton";
import {
  Header,
  Heading,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  SubmenuTrigger,
  Text
} from "@react-spectrum/s2/Menu";
import {
  createContext,
  useCallback,
  useContext,
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

export function ContextMenuProvider({
  registry,
  children
}: {
  registry: ContextMenuRegistry;
  children: ReactNode;
}) {
  const [state, setState] = useState<ContextMenuState>();
  const stateRef = useRef(state);
  stateRef.current = state;

  const closeContextMenu = useCallback(() => {
    const returnFocusTo = stateRef.current?.returnFocusTo;
    setState(undefined);
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

  return (
    <ContextMenuContext.Provider value={{ openContextMenu, openContextMenuAt, closeContextMenu }}>
      {children}
      {state ? (
        <MenuTrigger
          isOpen
          direction="bottom"
          align="start"
          onOpenChange={(isOpen) => {
            if (!isOpen) closeContextMenu();
          }}
        >
          <SpectrumActionButton
            aria-label={state.label}
            size="S"
            isQuiet
            UNSAFE_className="context-menu-anchor"
            UNSAFE_style={{ position: "fixed", left: state.x, top: state.y }}
          >
            <span aria-hidden="true">⋯</span>
          </SpectrumActionButton>
          <Menu aria-label={state.label} size="S">
            {state.sections.map((section) => (
              <MenuSection id={section.id} key={section.id}>
                <Header>
                  <Heading>{section.label}</Heading>
                </Header>
                {section.items.map((item) => renderItem(item, closeContextMenu))}
              </MenuSection>
            ))}
          </Menu>
        </MenuTrigger>
      ) : null}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu(): ContextMenuValue {
  const value = useContext(ContextMenuContext);
  if (!value) throw new Error("useContextMenu must be used inside ContextMenuProvider.");
  return value;
}
