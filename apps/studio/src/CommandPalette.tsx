import { useEffect, useMemo, useState } from "react";
import type { CommandRegistry } from "@agidn/studio-workbench";

export function CommandPalette({ commands, open, onClose }: { commands: CommandRegistry; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return commands.list().filter((command) => !normalized || `${command.title} ${command.category ?? ""}`.toLowerCase().includes(normalized));
  }, [commands, query]);
  if (!open) return null;
  return (
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command…" onKeyDown={(event) => event.key === "Escape" && onClose()} />
        <div className="command-list">
          {matches.map((command, index) => (
            <button type="button" className={index === 0 ? "is-selected" : ""} key={command.id} onClick={() => { void commands.execute(command.id); onClose(); }}>
              <span><small>{command.category ?? "Command"}</small>{command.title}</span>
              {command.keybinding ? <kbd>{command.keybinding}</kbd> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
