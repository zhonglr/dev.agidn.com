import { useCallback, useEffect, useRef, useState } from "react";
import { type TokenRegistry } from "@agidn/design-tokens";
import { checkPageDocument, type PageDocument } from "@agidn/document-schema";
import {
  decodeStudioToPreviewMessage,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewBreakpoint,
  type PreviewToStudioMessage
} from "@agidn/preview-protocol";
import { PageRenderer } from "@agidn/react-renderer";
import { applyDropGhost, type DropGhostState } from "./drop-ghost.js";
import pageSource from "../../../examples/golden-pricing/page.ui.json" with { type: "json" };
import tokenSource from "../../../examples/golden-pricing/tokens.json" with { type: "json" };
import { previewComponentRegistry } from "./components.js";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary.js";

const checked = checkPageDocument(pageSource);
if (!checked.valid)
  throw new Error(`Invalid preview document: ${checked.issues.map(({ message }) => message).join("; ")}`);
const initialDocument: PageDocument = checked.document;

type WithoutPreviewEnvelope<T> = T extends unknown ? Omit<T, "source" | "protocolVersion"> : never;
type PreviewPayload = WithoutPreviewEnvelope<PreviewToStudioMessage>;

interface PreviewState {
  document: PageDocument;
  revision: number;
  breakpoint: PreviewBreakpoint;
  initialized: boolean;
  selectedNodeId?: string;
  dropGhost?: DropGhostState | undefined;
}

function nodeElement(nodeId: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(
    (element) => element.dataset.nodeId === nodeId
  );
}

function rectFor(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height };
}

export function PreviewApp() {
  const [state, setState] = useState<PreviewState>({
    document: initialDocument,
    revision: 0,
    breakpoint: "desktop",
    initialized: false
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const post = useCallback((message: PreviewPayload): void => {
    window.parent.postMessage({ ...message, source: "agidn.preview", protocolVersion: PREVIEW_PROTOCOL_VERSION }, "*");
  }, []);

  const postBounds = useCallback(
    (nodeId: string, requestId: string): void => {
      const element = nodeElement(nodeId);
      if (!element) return;
      post({
        type: "preview.nodeBounds",
        requestId,
        documentRevision: stateRef.current.revision,
        nodeId,
        rect: rectFor(element)
      });
    },
    [post]
  );

  useEffect(() => {
    // Re-announce while mounted so a parent cannot permanently miss readiness
    // when the iframe message races its load event.
    const announceReady = (): void =>
      post({ type: "preview.ready", requestId: "preview_ready", documentRevision: stateRef.current.revision });
    announceReady();
    const readyInterval = window.setInterval(announceReady, 500);
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== window.parent) return;
      const decoded = decodeStudioToPreviewMessage(event.data);
      if (!decoded.valid) return;
      const message = decoded.message;
      const replacesDocument =
        (message.type === "preview.initialize" || message.type === "preview.setDocument") &&
        message.document.id !== stateRef.current.document.id;
      if (!replacesDocument && message.documentRevision < stateRef.current.revision) return;

      if (message.type === "preview.initialize") {
        setState({
          document: message.document,
          revision: message.documentRevision,
          breakpoint: message.breakpoint,
          initialized: true,
          ...(message.selectedNodeId ? { selectedNodeId: message.selectedNodeId } : {})
        });
      } else if (message.type === "preview.setDocument") {
        setState((current) => ({
          ...current,
          document: message.document,
          revision: message.documentRevision,
          initialized: true,
          dropGhost: undefined
        }));
      } else if (message.type === "preview.showDropGhost") {
        setState((current) => ({
          ...current,
          dropGhost: {
            target: message.target,
            node: message.node,
            ...(message.moveSourceNodeId ? { moveSourceNodeId: message.moveSourceNodeId } : {})
          }
        }));
      } else if (message.type === "preview.hideDropGhost") {
        setState((current) => (current.dropGhost ? { ...current, dropGhost: undefined } : current));
      } else if (message.type === "preview.setBreakpoint") {
        setState((current) => ({ ...current, breakpoint: message.breakpoint }));
      } else if (message.type === "preview.setSelection") {
        setState((current) => {
          const { selectedNodeId: _previous, ...rest } = current;
          return message.nodeId ? { ...rest, selectedNodeId: message.nodeId } : rest;
        });
        if (message.nodeId) requestAnimationFrame(() => postBounds(message.nodeId!, message.requestId));
      } else if (
        message.type === "preview.hitTest" ||
        message.type === "preview.resolveDrop" ||
        message.type === "preview.resolveMove"
      ) {
        const target = document
          .elementFromPoint(message.x - window.scrollX, message.y - window.scrollY)
          ?.closest<HTMLElement>("[data-node-id]");
        if (!target?.dataset.nodeId) return;
        const nodeId = target.dataset.nodeId;
        const nodeKind = target.dataset.nodeKind === "layout" ? "layout" : "component";
        if (message.type === "preview.resolveDrop") {
          post({
            type: "preview.dropIntent",
            requestId: message.requestId,
            documentRevision: stateRef.current.revision,
            nodeId,
            nodeKind,
            rect: rectFor(target),
            pointerX: message.x,
            pointerY: message.y
          });
        } else if (message.type === "preview.resolveMove") {
          post({
            type: "preview.moveIntent",
            requestId: message.requestId,
            documentRevision: stateRef.current.revision,
            sourceNodeId: message.sourceNodeId,
            nodeId,
            nodeKind,
            rect: rectFor(target),
            pointerX: message.x,
            pointerY: message.y
          });
        } else {
          post({
            type: "preview.nodePointerDown",
            requestId: message.requestId,
            documentRevision: stateRef.current.revision,
            nodeId,
            nodeKind,
            ...(target.dataset.componentRef ? { componentRef: target.dataset.componentRef } : {}),
            rect: rectFor(target)
          });
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(readyInterval);
      window.removeEventListener("message", onMessage);
    };
  }, [post, postBounds]);

  useEffect(() => {
    if (!state.initialized) return;
    document.documentElement.dataset.breakpoint = state.breakpoint;
    const nodeId = state.selectedNodeId;
    if (!nodeId) return;
    const element = nodeElement(nodeId);
    if (!element) return;
    // While a drop ghost is mounted the layout is in flux; reporting bounds
    // would make Studio auto-reveal the selection and pan the canvas mid-drag.
    const update = (): void => {
      if (stateRef.current.dropGhost) return;
      postBounds(nodeId, `bounds_${state.revision}`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [postBounds, state.breakpoint, state.initialized, state.revision, state.selectedNodeId]);

  useEffect(() => {
    if (!state.initialized) return;
    const update = (): void => {
      const root = document.documentElement;
      const page = document.querySelector<HTMLElement>(".agidn-page");
      const pageTop = page?.getBoundingClientRect().top ?? 0;
      const contentHeight = page
        ? Math.max(
            0,
            ...[...page.children].map((child) => child.getBoundingClientRect().bottom - pageTop)
          )
        : root.scrollHeight;
      post({
        type: "preview.contentOverflow",
        requestId: `overflow_${state.revision}`,
        documentRevision: state.revision,
        horizontal: root.scrollWidth > root.clientWidth,
        vertical: contentHeight > root.clientHeight,
        contentWidth: root.scrollWidth,
        contentHeight
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [post, state.breakpoint, state.document, state.initialized, state.revision]);

  if (!state.initialized) {
    return <div className="preview-pending" aria-hidden="true" />;
  }

  const renderedDocument = state.dropGhost ? applyDropGhost(state.document, state.dropGhost) : state.document;

  return (
    <PreviewErrorBoundary
      resetKey={`${state.document.id}:${state.revision}`}
      onError={(error) =>
        post({
          type: "preview.renderError",
          requestId: `render_${state.revision}`,
          documentRevision: state.revision,
          message: error.message
        })
      }
    >
      {state.dropGhost?.moveSourceNodeId ? (
        <style>{`[data-node-id="${state.dropGhost.moveSourceNodeId}"]{display:none!important}`}</style>
      ) : null}
      <PageRenderer
        document={renderedDocument}
        tokens={tokenSource as TokenRegistry}
        components={previewComponentRegistry}
        onAction={(actionRef, argumentsValue) => console.info("Preview action", actionRef, argumentsValue)}
      />
    </PreviewErrorBoundary>
  );
}
