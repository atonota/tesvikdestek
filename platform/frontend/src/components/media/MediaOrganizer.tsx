/**
 * Folders, collections and the metadata editor.
 *
 * The tree is a real `role="tree"` with roving focus and the arrow-key
 * behaviour the WAI-ARIA pattern specifies, because a nested `<ul>` of buttons
 * looks identical and navigates nothing: a screen-reader user gets no depth, no
 * expanded state and no sense of where they are.
 *
 * The metadata editor is honest about its reach. `durableMetadata` is blocked,
 * so edits live in this session only, and the form says so *before* the user
 * types rather than after they lose the work.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { Card, FormField } from "../composites";
import { EmptyState, PartialDataNotice } from "../patterns";
import { Badge, Button, Input, Textarea } from "../primitives";
import type { MediaCapabilities, MediaFolder, MediaTag } from "./types";

/* ------------------------------------------------------------------ tree */

interface TreeNode {
  readonly folder: MediaFolder;
  readonly depth: number;
  readonly children: readonly TreeNode[];
}

function buildTree(folders: readonly MediaFolder[], parentId: string | null, depth = 0): TreeNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => ({ folder, depth, children: buildTree(folders, folder.id, depth + 1) }));
}

/** Depth-first list of the nodes currently reachable, for roving focus. */
function flatten(nodes: readonly TreeNode[], expanded: ReadonlySet<string>): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children.length > 0 && expanded.has(node.folder.id)) {
      out.push(...flatten(node.children, expanded));
    }
  }
  return out;
}

export interface FolderTreeProps {
  readonly folders: readonly MediaFolder[];
  readonly selectedId?: string | null;
  readonly onSelect?: (folderId: string | null) => void;
  readonly label?: string;
  readonly className?: string;
}

/** States: empty · collapsed · expanded · selected. */
export function FolderTree({
  folders,
  selectedId = null,
  onSelect,
  label = "Klasörler ve koleksiyonlar",
  className,
}: FolderTreeProps) {
  const tree = useMemo(() => buildTree(folders, null), [folders]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(folders.filter((folder) => folder.parentId === null).map((folder) => folder.id)),
  );
  const [focusedId, setFocusedId] = useState<string | null>(tree[0]?.folder.id ?? null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  const visible = useMemo(() => flatten(tree, expanded), [tree, expanded]);

  const focusAt = useCallback((id: string) => {
    setFocusedId(id);
    itemRefs.current.get(id)?.focus();
  }, []);

  const toggle = useCallback((id: string, open: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  if (folders.length === 0) {
    return <p className="dt-muted">Klasör tanımlı değil.</p>;
  }

  const onKeyDown = (event: React.KeyboardEvent, node: TreeNode) => {
    const index = visible.findIndex((item) => item.folder.id === node.folder.id);
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.folder.id);

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = visible[index + 1];
        if (next) focusAt(next.folder.id);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const previous = visible[index - 1];
        if (previous) focusAt(previous.folder.id);
        break;
      }
      case "ArrowRight":
        event.preventDefault();
        if (hasChildren && !isOpen) toggle(node.folder.id, true);
        else if (hasChildren && isOpen) {
          const child = node.children[0];
          if (child) focusAt(child.folder.id);
        }
        break;
      case "ArrowLeft": {
        event.preventDefault();
        if (hasChildren && isOpen) {
          toggle(node.folder.id, false);
          break;
        }
        const parent = visible.find((item) => item.folder.id === node.folder.parentId);
        if (parent) focusAt(parent.folder.id);
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = visible[0];
        if (first) focusAt(first.folder.id);
        break;
      }
      case "End": {
        event.preventDefault();
        const last = visible[visible.length - 1];
        if (last) focusAt(last.folder.id);
        break;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect?.(node.folder.id);
        break;
      default:
        break;
    }
  };

  const renderNodes = (nodes: readonly TreeNode[]) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isOpen = expanded.has(node.folder.id);
      const isSelected = selectedId === node.folder.id;
      return (
        <li key={node.folder.id} role="none">
          <div
            role="treeitem"
            aria-selected={isSelected}
            aria-level={node.depth + 1}
            {...(hasChildren ? { "aria-expanded": isOpen } : {})}
            tabIndex={focusedId === node.folder.id ? 0 : -1}
            ref={(element) => {
              if (element) itemRefs.current.set(node.folder.id, element);
              else itemRefs.current.delete(node.folder.id);
            }}
            className={cn("dt-tree__item", isSelected && "is-selected")}
            style={{ paddingInlineStart: `${node.depth * 1.1 + 0.5}rem` }}
            onClick={() => {
              setFocusedId(node.folder.id);
              onSelect?.(node.folder.id);
            }}
            onKeyDown={(event) => onKeyDown(event, node)}
          >
            {hasChildren ? (
              <span aria-hidden="true" className="dt-tree__twisty">
                {isOpen ? "▾" : "▸"}
              </span>
            ) : (
              <span aria-hidden="true" className="dt-tree__twisty" />
            )}
            <span className="dt-tree__name">{node.folder.name}</span>
            <span className="dt-muted"> ({node.folder.assetCount})</span>
          </div>
          {hasChildren && isOpen ? (
            <ul role="group" className="dt-tree__group">
              {renderNodes(node.children)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <ul role="tree" aria-label={label} className={cn("dt-tree", className)}>
      {renderNodes(tree)}
    </ul>
  );
}

/* -------------------------------------------------------------- metadata */

export interface MetadataDraft {
  readonly description: string;
  readonly tags: readonly MediaTag[];
}

export interface MediaOrganizerProps {
  readonly folders: readonly MediaFolder[];
  readonly capabilities: MediaCapabilities;
  readonly selectedFolderId?: string | null;
  readonly onSelectFolder?: (folderId: string | null) => void;
  readonly draft?: MetadataDraft;
  readonly onDraftChange?: (draft: MetadataDraft) => void;
  readonly className?: string;
}

/**
 * States: read-only (no permission) · editable-session-only · with-tags ·
 * empty-tree.
 */
export function MediaOrganizer({
  folders,
  capabilities,
  selectedFolderId = null,
  onSelectFolder,
  draft,
  onDraftChange,
  className,
}: MediaOrganizerProps) {
  const [tagInput, setTagInput] = useState("");
  const editable = capabilities.permissions.canEditMetadata;
  const current = draft ?? { description: "", tags: [] };

  const addTag = () => {
    const label = tagInput.trim();
    if (!label || !onDraftChange) return;
    if (current.tags.some((tag) => tag.label.toLocaleLowerCase("tr") === label.toLocaleLowerCase("tr"))) {
      setTagInput("");
      return;
    }
    onDraftChange({ ...current, tags: [...current.tags, { id: label, label }] });
    setTagInput("");
  };

  return (
    <div className={cn("dt-media-organizer", className)}>
      <Card title="Klasörler" headingLevel={3}>
        <FolderTree
          folders={folders}
          selectedId={selectedFolderId}
          {...(onSelectFolder ? { onSelect: onSelectFolder } : {})}
        />
      </Card>

      <Card title="Üstveri ve etiketler" headingLevel={3}>
        {!capabilities.durableMetadata ? (
          <PartialDataNotice
            what="Buradaki düzenlemeler kaydedilmiyor."
            because="Üstveri yazma ucu backend'de yok. Girdikleriniz yalnızca bu sekmede yaşar ve sayfa yenilenince kaybolur."
          />
        ) : null}

        {!editable ? (
          <EmptyState
            title="Üstveri düzenleme kapalı"
            reason="Bu oturumda üstveri düzenleme yetkisi tanımlı değil."
          />
        ) : (
          <>
            <FormField id="media-description" label="Açıklama">
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={3}
                  value={current.description}
                  onChange={(event) =>
                    onDraftChange?.({ ...current, description: event.target.value })
                  }
                />
              )}
            </FormField>

            <FormField id="media-tag" label="Etiket ekle" hint="Enter ile ekleyin.">
              {(aria) => (
                <Input
                  {...aria}
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addTag();
                  }}
                />
              )}
            </FormField>

            <ul className="dt-media-organizer__tags" aria-label="Etiketler">
              {current.tags.length === 0 ? (
                <li className="dt-muted">Etiket yok.</li>
              ) : (
                current.tags.map((tag) => (
                  <li key={tag.id}>
                    <Badge tone="accent">{tag.label}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`${tag.label} etiketini kaldır`}
                      onClick={() =>
                        onDraftChange?.({
                          ...current,
                          tags: current.tags.filter((item) => item.id !== tag.id),
                        })
                      }
                    >
                      ×
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
