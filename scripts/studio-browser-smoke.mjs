import { spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const foundationFiles = [
  "page.ui.json",
  "components.json",
  "tokens.json",
  "policies.json",
  "interactions.json",
  "constraints.json",
  "assets.json"
];
const insertCases = [
  ["component", "Button"],
  ["component", "Link"],
  ["component", "Heading"],
  ["component", "Text"],
  ["component", "Image"],
  ["component", "Icon"],
  ["component", "Badge"],
  ["component", "Card"],
  ["component", "Divider"],
  ["component", "project.foundation-callout"],
  ["layout", "section"],
  ["layout", "container"],
  ["layout", "stack"],
  ["layout", "row"],
  ["layout", "grid"],
  ["layout", "overlay"],
  ["pattern", "project.two-column-copy"]
];

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a local port.");
  const port = address.port;
  await new Promise((resolveClose, reject) =>
    server.close((error) => error ? reject(error) : resolveClose())
  );
  return port;
}

async function waitForHttp(url, label, processLog, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await delay(100);
  }
  throw new Error(`${label} did not become ready at ${url}.\n${processLog()}`);
}

function startProcess(command, argumentsValue, options = {}) {
  const chunks = [];
  const child = spawn(command, argumentsValue, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collect = (chunk) => {
    chunks.push(String(chunk));
    if (chunks.length > 200) chunks.shift();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  return {
    child,
    log: () => chunks.join(""),
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolveExit) => child.once("exit", resolveExit)),
        delay(2_000).then(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        })
      ]);
    }
  };
}

async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicit candidate.
    }
  }
  throw new Error(
    "Chrome was not found. Set AGIDN_CHROME_BIN to a Chrome or Chromium executable."
  );
}

class DevToolsConnection {
  constructor(url) {
    this.url = url;
    this.sequence = 0;
    this.pending = new Map();
    this.exceptions = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const callback = this.pending.get(message.id);
        if (callback) {
          this.pending.delete(message.id);
          callback(message);
        }
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(
          message.params?.exceptionDetails?.exception?.description ??
          message.params?.exceptionDetails?.text ??
          "Unknown browser exception"
        );
      }
    });
  }

  command(method, params = {}) {
    const id = ++this.sequence;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveCommand, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools command '${method}' timed out.`));
      }, 10_000);
      this.pending.set(id, (message) => {
        clearTimeout(timeout);
        if (message.error) reject(new Error(message.error.message));
        else resolveCommand(message.result);
      });
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.command("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Browser evaluation failed."
      );
    }
    return result.result.value;
  }

  close() {
    this.socket?.close();
  }
}

async function waitForEditor(connection) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const ready = await connection.evaluate(`Boolean(
      document.querySelector('.canvas-viewport') &&
      document.querySelectorAll('[data-insert-type="component"]').length === 10 &&
      document.querySelectorAll('[data-insert-type="layout"]').length === 6 &&
      document.body.innerText.includes('Trackpad to pan')
    )`);
    if (ready) return;
    await delay(100);
  }
  throw new Error("Studio did not expose the 10 component and 6 layout insert sources.");
}

async function dragInsert(connection, type, id, targetPageRoot = false) {
  return connection.evaluate(`(async () => {
    const tile = document.querySelector(
      '[data-insert-type="${type}"][data-insert-id="${id}"]'
    );
    const canvas = document.querySelector('.canvas-viewport');
    if (!tile || !canvas) {
      return { ok: false, reason: 'insert source or canvas missing' };
    }
    const transfer = new DataTransfer();
    const sourceRect = tile.getBoundingClientRect();
    tile.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX: sourceRect.left + 8,
      clientY: sourceRect.top + 8
    }));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
    const canvasRect = canvas.getBoundingClientRect();
    const pageRect = document.querySelector('.canvas-preview')?.getBoundingClientRect();
    const targetPageRoot = ${JSON.stringify(targetPageRoot)};
    const clientX = targetPageRoot && pageRect
      ? pageRect.left + pageRect.width * 0.5
      : canvasRect.left + canvasRect.width * 0.5;
    const clientY = targetPageRoot && pageRect
      ? Math.min(pageRect.bottom - 24, canvasRect.bottom - 24)
      : canvasRect.top + canvasRect.height * 0.42;
    canvas.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX,
      clientY
    }));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 220));
    canvas.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX,
      clientY
    }));
    tile.dispatchEvent(new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX,
      clientY
    }));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    return { ok: true, mimeTypes: [...transfer.types] };
  })()`, true);
}

async function getDocument(workspaceUrl) {
  const response = await fetch(`${workspaceUrl}/v1/project`);
  if (!response.ok) throw new Error(`Project request failed with ${response.status}.`);
  return response.json();
}

async function getHistory(workspaceUrl) {
  const response = await fetch(`${workspaceUrl}/v1/project/history`);
  if (!response.ok) throw new Error(`History request failed with ${response.status}.`);
  return response.json();
}

async function waitForRevision(workspaceUrl, minimumRevision) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const value = await getDocument(workspaceUrl);
    if (value.revision.revision >= minimumRevision) return value;
    await delay(50);
  }
  throw new Error(`Revision ${minimumRevision} was not published within 5 seconds.`);
}

async function waitForBrowser(connectionValue, expression, label, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await connectionValue.evaluate(`Boolean(${expression})`)) return;
    await delay(50);
  }
  throw new Error(`${label} was not visible in Studio within ${timeout}ms.`);
}

async function waitForStudioIdle(connectionValue) {
  await waitForBrowser(
    connectionValue,
    `document.querySelector('.component-tile') &&
      !document.querySelector('.component-tile.is-disabled')`,
    "Studio editable state"
  );
}

async function expandOutline(connectionValue) {
  await connectionValue.evaluate(`(async () => {
    for (let pass = 0; pass < 8; pass += 1) {
      const collapsed = [...document.querySelectorAll(
        '.outline-panel .tree-disclosure'
      )].filter((button) => button.textContent?.trim() === '▸');
      if (collapsed.length === 0) return;
      collapsed.forEach((button) => button.click());
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    }
  })()`, true);
}

async function searchComponents(connectionValue, query) {
  const focused = await connectionValue.evaluate(`(() => {
    const input = document.querySelector('.component-panel .tool-search input');
    if (!(input instanceof HTMLInputElement)) return false;
    input.focus();
    input.select();
    return true;
  })()`);
  if (!focused) throw new Error("Components search input is unavailable.");
  if (query) {
    await connectionValue.command("Input.insertText", { text: query });
  } else {
    await connectionValue.evaluate(`(() => {
      const input = document.querySelector('.component-panel .tool-search input');
      if (!(input instanceof HTMLInputElement)) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, '');
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'deleteContentBackward'
      }));
    })()`);
  }
}

function documentNode(documentValue, nodeId) {
  const visit = (node) => {
    if (node.id === nodeId) return node;
    const children =
      node.kind === "layout"
        ? node.children
        : Object.values(node.slots ?? {}).flat();
    for (const child of children) {
      const match = visit(child);
      if (match) return match;
    }
    return undefined;
  };
  for (const child of documentValue.children) {
    const match = visit(child);
    if (match) return match;
  }
  return undefined;
}

function containingCollection(documentValue, nodeId) {
  const visit = (ownerId, children) => {
    if (children.some(({ id }) => id === nodeId)) {
      return { ownerId, ids: children.map(({ id }) => id) };
    }
    for (const child of children) {
      const collections =
        child.kind === "layout"
          ? [[child.id, child.children]]
          : Object.entries(child.slots ?? {}).map(([slot, values]) => [
              `${child.id}:${slot}`,
              values
            ]);
      for (const [collectionId, values] of collections) {
        const match = visit(collectionId, values);
        if (match) return match;
      }
    }
    return undefined;
  };
  return visit(documentValue.id, documentValue.children);
}

async function editInspectorProp(connectionValue, nodeId, property, value) {
  const result = await connectionValue.evaluate(`(() => {
    const inspector = document.querySelector(
      '.inspector[data-selected-node-id=${JSON.stringify(nodeId)}]'
    );
    const field = inspector?.querySelector(
      '[data-inspector-prop=${JSON.stringify(property)}]'
    );
    const input = field?.querySelector('input, textarea');
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      return { ok: false, reason: 'Inspector input missing' };
    }
    input.focus();
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: ${JSON.stringify(value)}
    }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    return { ok: true };
  })()`);
  if (!result.ok) throw new Error(result.reason);
}

async function pressOutlineKey(connectionValue, nodeId, key, altKey = false) {
  const result = await connectionValue.evaluate(`(() => {
    const row = document.querySelector(
      '.outline-panel [role="treeitem"][data-node-id=${JSON.stringify(nodeId)}]'
    );
    if (!(row instanceof HTMLElement)) return false;
    row.focus();
    return true;
  })()`);
  if (!result) throw new Error(`Outline row '${nodeId}' is unavailable.`);
  const code =
    key === "ArrowUp"
      ? "ArrowUp"
      : key === "ArrowDown"
        ? "ArrowDown"
        : key === "Backspace"
          ? "Backspace"
          : "Delete";
  await connectionValue.command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    modifiers: altKey ? 1 : 0
  });
  await connectionValue.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    modifiers: altKey ? 1 : 0
  });
}

async function pressShortcut(connectionValue, key, shiftKey = false) {
  await connectionValue.evaluate("document.body.focus()");
  const modifiers = 2 | (shiftKey ? 8 : 0);
  await connectionValue.command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code: `Key${key.toUpperCase()}`,
    modifiers
  });
  await connectionValue.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code: `Key${key.toUpperCase()}`,
    modifiers
  });
}

async function commitExternalCommand(workspaceUrl, baseRevision, command) {
  const response = await fetch(`${workspaceUrl}/v1/project/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocolVersion: "2.0.0",
      baseRevision,
      source: "system",
      commands: [command]
    })
  });
  const value = await response.json();
  if (!response.ok || !value.ok) {
    throw new Error(`External command failed: ${JSON.stringify(value)}`);
  }
  return value;
}

async function undo(workspaceUrl, baseRevision) {
  const response = await fetch(`${workspaceUrl}/v1/project/undo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ protocolVersion: "2.0.0", baseRevision })
  });
  if (!response.ok) {
    throw new Error(`Undo failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "agidn-studio-e2e-"));
const projectDirectory = join(temporaryRoot, "foundation");
const processes = [];
let connection;

try {
  await mkdir(projectDirectory);
  await Promise.all(
    foundationFiles.map((file) =>
      cp(
        resolve(root, "examples/foundation", file),
        resolve(projectDirectory, file),
        { recursive: true }
      )
    )
  );
  const componentPath = resolve(projectDirectory, "components.json");
  const componentSource = JSON.parse(await readFile(componentPath, "utf8"));
  componentSource.components.Button.editor.presets = {};
  await writeFile(componentPath, `${JSON.stringify(componentSource, null, 2)}\n`, "utf8");

  const [workspacePort, studioPort, debugPort] = await Promise.all([
    freePort(),
    freePort(),
    freePort()
  ]);
  const workspaceUrl = `http://127.0.0.1:${workspacePort}`;
  const studioUrl = `http://127.0.0.1:${studioPort}`;

  const workspace = startProcess(
    resolve(root, "node_modules/.bin/tsx"),
    [
      resolve(root, "apps/workspace-server/src/server.ts"),
      resolve(projectDirectory, "page.ui.json"),
      String(workspacePort)
    ]
  );
  processes.push(workspace);
  await waitForHttp(`${workspaceUrl}/v1/project`, "Workspace Server", workspace.log);

  const studio = startProcess(
    resolve(root, "node_modules/.bin/vite"),
    [
      "--config",
      resolve(root, "apps/studio/vite.config.ts"),
      "--host",
      "127.0.0.1",
      "--port",
      String(studioPort),
      "--strictPort"
    ],
    {
      env: {
        VITE_WORKSPACE_SERVER_URL: workspaceUrl
      }
    }
  );
  processes.push(studio);
  await waitForHttp(studioUrl, "Studio", studio.log);

  const chromeExecutable = await firstExecutable([
    process.env.AGIDN_CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ]);
  const chrome = startProcess(chromeExecutable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${join(temporaryRoot, "chrome-profile")}`,
    "about:blank"
  ]);
  processes.push(chrome);
  await waitForHttp(
    `http://127.0.0.1:${debugPort}/json/version`,
    "Chrome DevTools",
    chrome.log
  );

  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(studioUrl)}`,
    { method: "PUT" }
  ).then((response) => response.json());
  connection = new DevToolsConnection(target.webSocketDebuggerUrl);
  await connection.connect();
  await connection.command("Runtime.enable");
  await connection.command("Page.enable");
  await waitForEditor(connection);
  const catalogWithPresetlessButton = await fetch(
    `${workspaceUrl}/v1/catalog`
  ).then((response) => response.json());
  if (
    Object.keys(
      catalogWithPresetlessButton.components.components.Button.editor.presets
    ).length !== 0 ||
    !(await connection.evaluate(
      `Boolean(document.querySelector(
        '[data-insert-type="component"][data-insert-id="Button"]'
      ))`
    ))
  ) {
    throw new Error("A registered component without Presets was hidden.");
  }
  await searchComponents(connection, "navigation");
  await waitForBrowser(
    connection,
    `document.querySelector(
      '[data-insert-type="component"][data-insert-id="Link"]'
    ) && !document.querySelector(
      '[data-insert-type="component"][data-insert-id="Button"]'
    )`,
    "Filtered Components result"
  );
  await searchComponents(connection, "");
  await waitForEditor(connection);
  console.log("PASS Components states → no Preset and search");

  {
    const before = await getDocument(workspaceUrl);
    const beforeRevision = before.revision.revision;
    const dragResult = await dragInsert(
      connection,
      "component",
      "Text",
      true
    );
    if (!dragResult.ok) {
      throw new Error(
        `Page-root Text drag failed: ${dragResult.reason}`
      );
    }
    const after = await waitForRevision(
      workspaceUrl,
      beforeRevision + 1
    );
    if (after.revision.revision !== beforeRevision + 1) {
      throw new Error(
        "Page-root drop did not create exactly one revision."
      );
    }
    console.log(
      "PASS page-root drop → blank Canvas area remains a valid target"
    );
  }

  for (const [type, id] of insertCases) {
    const before = await getDocument(workspaceUrl);
    const beforeRevision = before.revision.revision;
    const dragResult = await dragInsert(connection, type, id);
    if (!dragResult.ok) throw new Error(`${type}:${id} drag failed: ${dragResult.reason}`);
    const after = await waitForRevision(workspaceUrl, beforeRevision + 1);
    if (after.revision.revision !== beforeRevision + 1) {
      throw new Error(
        `${type}:${id} created ${after.revision.revision - beforeRevision} revisions instead of one.`
      );
    }
    const history = await getHistory(workspaceUrl);
    const entry = history.entries.find(({ revision }) => revision === after.revision.revision);
    if (
      entry?.kind !== "commit" ||
      entry.commands.length !== 1 ||
      entry.commands[0]?.type !== "node.insert"
    ) {
      throw new Error(`${type}:${id} did not create exactly one node.insert command.`);
    }
    const inserted = entry.commands[0].node;
    if (
      (type === "component" && (inserted.kind !== "component" || inserted.componentRef !== id)) ||
      (type === "layout" && (inserted.kind !== "layout" || inserted.layout !== id)) ||
      (
        type === "pattern" &&
        (inserted.kind !== "layout" || inserted.layout !== "grid")
      )
    ) {
      throw new Error(`${type}:${id} inserted the wrong node payload.`);
    }

    const undone = await undo(workspaceUrl, after.revision.revision);
    if (undone.revision.revision !== after.revision.revision + 1) {
      throw new Error(`${type}:${id} cleanup undo did not publish exactly one revision.`);
    }
    await connection.command("Page.reload", { ignoreCache: true });
    // Page.reload acknowledges before the old execution context is discarded.
    // Wait past that boundary before querying the newly mounted editor.
    await delay(300);
    await waitForEditor(connection);
    console.log(`PASS ${type}:${id} → one node.insert revision`);
  }

  const beforeEditing = await getDocument(workspaceUrl);
  await dragInsert(connection, "component", "Text");
  const created = await waitForRevision(
    workspaceUrl,
    beforeEditing.revision.revision + 1
  );
  const createHistory = await getHistory(workspaceUrl);
  const createEntry = createHistory.entries.find(
    ({ revision }) => revision === created.revision.revision
  );
  const createdNodeId = createEntry?.commands[0]?.node?.id;
  if (
    createEntry?.commands[0]?.type !== "node.insert" ||
    typeof createdNodeId !== "string"
  ) {
    throw new Error("Basic editing smoke could not identify the created Text node.");
  }
  await waitForBrowser(
    connection,
    `document.querySelector(
      '.outline-panel [data-node-id=${JSON.stringify(createdNodeId)}][aria-selected="true"]'
    )`,
    "Created Text selection"
  );

  await editInspectorProp(
    connection,
    createdNodeId,
    "text",
    "Browser edited"
  );
  const edited = await waitForRevision(
    workspaceUrl,
    created.revision.revision + 1
  );
  if (documentNode(edited.revision.project.document, createdNodeId)?.props?.text !== "Browser edited") {
    throw new Error("Inspector edit did not reach the PageDocument.");
  }
  await waitForStudioIdle(connection);

  const beforeMove = containingCollection(edited.revision.project.document, createdNodeId);
  const beforeIndex = beforeMove?.ids.indexOf(createdNodeId) ?? -1;
  if (!beforeMove || beforeIndex < 0 || beforeMove.ids.length < 2) {
    throw new Error("Created Text node has no movable sibling.");
  }
  const moveKey = beforeIndex > 0 ? "ArrowUp" : "ArrowDown";
  const expectedMovedIds = [...beforeMove.ids];
  const swapIndex = beforeIndex > 0 ? beforeIndex - 1 : beforeIndex + 1;
  [expectedMovedIds[beforeIndex], expectedMovedIds[swapIndex]] = [
    expectedMovedIds[swapIndex],
    expectedMovedIds[beforeIndex]
  ];
  await pressOutlineKey(connection, createdNodeId, moveKey, true);
  const moved = await waitForRevision(
    workspaceUrl,
    edited.revision.revision + 1
  );
  const movedCollection = containingCollection(moved.revision.project.document, createdNodeId);
  if (JSON.stringify(movedCollection?.ids) !== JSON.stringify(expectedMovedIds)) {
    throw new Error("Outline keyboard move produced the wrong sibling order.");
  }
  await waitForStudioIdle(connection);

  await pressShortcut(connection, "z");
  const moveUndone = await waitForRevision(
    workspaceUrl,
    moved.revision.revision + 1
  );
  if (
    JSON.stringify(containingCollection(moveUndone.revision.project.document, createdNodeId)?.ids) !==
    JSON.stringify(beforeMove.ids)
  ) {
    throw new Error("Studio undo did not restore the pre-move order.");
  }
  await waitForStudioIdle(connection);

  await pressShortcut(connection, "z", true);
  const moveRedone = await waitForRevision(
    workspaceUrl,
    moveUndone.revision.revision + 1
  );
  if (
    JSON.stringify(containingCollection(moveRedone.revision.project.document, createdNodeId)?.ids) !==
    JSON.stringify(expectedMovedIds)
  ) {
    throw new Error("Studio redo did not restore the moved order.");
  }
  await waitForStudioIdle(connection);

  await pressOutlineKey(connection, createdNodeId, "Delete");
  const removed = await waitForRevision(
    workspaceUrl,
    moveRedone.revision.revision + 1
  );
  if (documentNode(removed.revision.project.document, createdNodeId)) {
    throw new Error("Outline Delete did not remove the selected node.");
  }
  await waitForStudioIdle(connection);

  await pressShortcut(connection, "z");
  const removeUndone = await waitForRevision(
    workspaceUrl,
    removed.revision.revision + 1
  );
  if (!documentNode(removeUndone.revision.project.document, createdNodeId)) {
    throw new Error("Studio undo did not restore the removed node.");
  }
  await waitForStudioIdle(connection);
  await connection.command("Page.reload", { ignoreCache: true });
  await delay(300);
  await waitForEditor(connection);
  await expandOutline(connection);
  await waitForBrowser(
    connection,
    `document.querySelector(
      '.outline-panel [data-node-id=${JSON.stringify(createdNodeId)}]'
    )`,
    "Reloaded Text node"
  );

  await connection.evaluate(`document.querySelector(
    '.outline-panel [data-node-id=${JSON.stringify(createdNodeId)}]'
  )?.click()`);
  await waitForBrowser(
    connection,
    `document.querySelector(
      '.inspector[data-selected-node-id=${JSON.stringify(createdNodeId)}]'
    )`,
    "Reloaded Text inspector"
  );
  const external = await commitExternalCommand(
    workspaceUrl,
    removeUndone.revision.revision,
    {
      protocolVersion: "2.0.0",
      commandId: "external_conflict_revision",
      type: "node.setName",
      nodeId: "heading_foundation",
      name: "External revision"
    }
  );
  await editInspectorProp(
    connection,
    createdNodeId,
    "text",
    "Rejected browser edit"
  );
  await waitForBrowser(
    connection,
    `document.querySelector('.inspector-error[role="alert"]')`,
    "Revision conflict error"
  );
  const afterRejection = await getDocument(workspaceUrl);
  if (
    afterRejection.revision.revision !== external.revision.revision ||
    documentNode(afterRejection.revision.project.document, createdNodeId)?.props?.text !== "Browser edited"
  ) {
    throw new Error("Rejected Studio edit polluted the current PageDocument.");
  }
  console.log(
    "PASS basic editing → create/select/edit/move/delete/undo/redo/reload/reject"
  );

  if (connection.exceptions.length > 0) {
    throw new Error(`Unhandled browser exceptions:\n${connection.exceptions.join("\n")}`);
  }

  await workspace.stop();
  await connection.command("Page.reload", { ignoreCache: true });
  await delay(300);
  await waitForBrowser(
    connection,
    `document.querySelector('.component-catalog-error[role="alert"]')`,
    "Offline Catalog state"
  );
  console.log("PASS Components state → Workspace offline");

  await writeFile(
    componentPath,
    `${JSON.stringify({
      schemaVersion: "2.0.0",
      components: {}
    }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    resolve(projectDirectory, "assets.json"),
    `${JSON.stringify({
      schemaVersion: "2.0.0",
      composites: {},
      patterns: {}
    }, null, 2)}\n`,
    "utf8"
  );
  const pagePath = resolve(projectDirectory, "page.ui.json");
  const emptyPage = JSON.parse(await readFile(pagePath, "utf8"));
  emptyPage.children = [];
  await writeFile(pagePath, `${JSON.stringify(emptyPage, null, 2)}\n`, "utf8");
  await rm(
    resolve(
      projectDirectory,
      ".revision-store",
      "page.ui.project-revisions.json"
    ),
    { force: true }
  );
  const emptyWorkspace = startProcess(
    resolve(root, "node_modules/.bin/tsx"),
    [
      resolve(root, "apps/workspace-server/src/server.ts"),
      resolve(projectDirectory, "page.ui.json"),
      String(workspacePort)
    ]
  );
  processes.push(emptyWorkspace);
  await waitForHttp(
    `${workspaceUrl}/v1/catalog`,
    "Empty Workspace Server",
    emptyWorkspace.log
  );
  await connection.command("Page.reload", { ignoreCache: true });
  await delay(300);
  await waitForBrowser(
    connection,
    `document.querySelector(
      '.component-panel .tool-empty:not(.component-catalog-error)'
    )`,
    "Empty Component Registry state"
  );
  console.log("PASS Components state → empty Registry");

  if (connection.exceptions.length > 0) {
    throw new Error(`Unhandled browser exceptions:\n${connection.exceptions.join("\n")}`);
  }
  console.log(`Studio browser smoke passed (${insertCases.length} insert sources).`);
} finally {
  connection?.close();
  for (const processValue of processes.reverse()) await processValue.stop();
  await rm(temporaryRoot, { recursive: true, force: true });
}
