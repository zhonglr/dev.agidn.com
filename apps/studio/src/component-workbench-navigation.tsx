import { createContext, useContext, type ReactNode } from "react";

interface ComponentWorkbenchNavigationValue {
  openComponentWorkbench: (componentId?: string) => void;
}

const ComponentWorkbenchNavigationContext = createContext<ComponentWorkbenchNavigationValue | undefined>(undefined);

export function ComponentWorkbenchNavigationProvider({
  children,
  openComponentWorkbench
}: {
  children: ReactNode;
  openComponentWorkbench: (componentId?: string) => void;
}) {
  return (
    <ComponentWorkbenchNavigationContext.Provider value={{ openComponentWorkbench }}>
      {children}
    </ComponentWorkbenchNavigationContext.Provider>
  );
}

export function useComponentWorkbenchNavigation(): ComponentWorkbenchNavigationValue {
  const value = useContext(ComponentWorkbenchNavigationContext);
  if (!value) throw new Error("useComponentWorkbenchNavigation must be used inside ComponentWorkbenchNavigationProvider.");
  return value;
}
