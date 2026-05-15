import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FileNode {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

interface FileTreeDnDProps {
  tree: FileNode[];
  onMoveFile: (sourcePath: string, targetDir: string) => void;
}

const FileItem: React.FC<{
  node: FileNode;
  selected: boolean;
  onSelect: (node: FileNode, multi: boolean) => void;
}> = ({ node, selected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id, data: { node } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`file-item ${selected ? "selected" : ""} ${node.isDir ? "directory" : "file"}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node, e.shiftKey || e.ctrlKey);
      }}
    >
      <span className="file-icon">{node.isDir ? "📁" : "📄"}</span>
      <span className="file-name">{node.name}</span>
    </div>
  );
};

const DropIndicator: React.FC<{ position: "before" | "after" | "inside" }> = ({
  position,
}) => (
  <div className={`drop-indicator drop-${position}`} />
);

export const FileTreeDnD: React.FC<FileTreeDnDProps> = ({ tree, onMoveFile }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after" | "inside";
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSelect = useCallback(
    (node: FileNode, multi: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(multi ? prev : []);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    },
    []
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const targetNode = findNode(tree, over.id as string);
      if (targetNode?.isDir) {
        setDropTarget({ id: over.id as string, position: "inside" });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sourceNode = findNode(tree, active.id as string);
      const targetNode = findNode(tree, over.id as string);
      if (sourceNode && targetNode?.isDir) {
        onMoveFile(sourceNode.path, targetNode.path);
      }
    }
    setActiveId(null);
    setDropTarget(null);
  };

  const activeNode = activeId ? findNode(tree, activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="file-tree" role="tree" aria-label="File tree">
          {tree.map((node) => (
            <div key={node.id}>
              <FileItem node={node} selected={selectedIds.has(node.id)} onSelect={handleSelect} />
              {dropTarget?.id === node.id && <DropIndicator position={dropTarget.position} />}
              {node.isDir && node.children && (
                <div className="file-tree-children" style={{ paddingLeft: 16 }}>
                  {node.children.map((child) => (
                    <FileItem key={child.id} node={child} selected={selectedIds.has(child.id)} onSelect={handleSelect} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeNode && (
          <div className="drag-overlay">
            <span>{activeNode.isDir ? "📁" : "📄"}</span>
            <span>{activeNode.name}</span>
            {selectedIds.size > 1 && <span className="drag-count">{selectedIds.size}</span>}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

function findNode(tree: FileNode[], id: string): FileNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default FileTreeDnD;
