import { ValidationContext } from "../types";

export type EventType =
  | "FlightSubmitted"
  | "GisLookupCompleted"
  | "RulesEvaluated"
  | "RiskCalculated"
  | "PermitGenerated"
  | "ExplanationGenerated"
  | "EvaluationFinished";

export type EventHandler = (context: ValidationContext) => void | Promise<void>;

/**
 * Clean Event broker to decouple engines execution during flight plan evaluation.
 */
export class EventSystem {
  private listeners: Map<EventType, EventHandler[]> = new Map();

  /**
   * Registers a listener for an event type.
   */
  public on(event: EventType, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Emits an event, executing all registered handlers in sequence.
   */
  public async emit(event: EventType, context: ValidationContext): Promise<void> {
    const handlers = this.listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (err) {
        console.error(`Error in event handler for event "${event}":`, err);
        context.results.explanations.push(`System error in event ${event}: ${(err as Error).message}`);
      }
    }
  }
}
