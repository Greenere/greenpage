import { BaseEdge, getSimpleBezierPath, type EdgeProps } from "@xyflow/react";

function DottedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {} }: EdgeProps) {
  const [path] = getSimpleBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        ...style,
        strokeDasharray: "4 2",
        stroke: `var(--color-secondary)`,
        strokeWidth: 2,
      }}
    />
  );
}

export const edgeTypes = { dotted: DottedEdge };
