import { PermitNode, ValidationContext } from "../types";
import { evaluateCondition } from "./ruleEngine";

/**
 * Traverses the permit decision graph based on context details to output required permits.
 */
export class PermitEngine {
  /**
   * Evaluates the decision workflow starting from a root node (usually the first node in the array).
   */
  public evaluatePermits(context: ValidationContext, nodes: PermitNode[]): void {
    if (nodes.length === 0) {
      return;
    }

    const nodeMap = new Map<string, PermitNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const referencedNodeIds = new Set<string>();
    for (const node of nodes) {
      if (node.nextTrueNodeId) referencedNodeIds.add(node.nextTrueNodeId);
      if (node.nextFalseNodeId) referencedNodeIds.add(node.nextFalseNodeId);
    }

    // Prefer graph root inferred from references, then fall back to first node.
    let currentNode: PermitNode | undefined = nodes.find((n) => !referencedNodeIds.has(n.id)) || nodes[0];

    const collectedPermits = new Set<string>();
    const evaluatedNodes = new Set<string>();

    while (currentNode) {
      // Prevent cycles
      if (evaluatedNodes.has(currentNode.id)) {
        break;
      }
      evaluatedNodes.add(currentNode.id);

      // Evaluate conditions for current decision step (AND logic)
      let criteriaMatched = true;
      for (const cond of currentNode.conditions) {
        if (!evaluateCondition(cond, context)) {
          criteriaMatched = false;
          break;
        }
      }

      let nextNodeId: string | null = null;
      if (criteriaMatched) {
        // Apply node's permit results
        for (const permit of currentNode.requiredPermits) {
          collectedPermits.add(permit);
        }
        nextNodeId = currentNode.nextTrueNodeId;
      } else {
        nextNodeId = currentNode.nextFalseNodeId;
      }

      currentNode = nextNodeId ? nodeMap.get(nextNodeId) : undefined;
    }

    context.results.requiredPermits = Array.from(collectedPermits);
  }
}
