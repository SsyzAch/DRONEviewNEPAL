# ADR 0001: Structured Dynamic Rule DSL

## Context and Problem
We need to evaluate complex regulatory constraints against a validation context (e.g. drone weight, altitude, nationality, spatial intersection results) dynamically. Storing rules as executable code strings or evaluating dynamic JS strings using `eval()` poses high security risks, is prone to syntax injection, and makes it difficult for non-technical users to manage rules.

## Considered Options
1. **Hardcoded Engine Code**: Compile all regulations directly as compiled JS/TS functions in `ruleEngine.ts`.
2. **Dynamic JS Eval**: Store rules as script expressions (e.g., `"drone.weightGrams >= 250"`) and run `eval()`.
3. **Structured Rule DSL**: Store rules as JSON structures defining conditions (`field`, `operator`, `value`).

## Decision and Rationale
We chose **Option 3 (Structured Rule DSL)**. 
By representing condition arrays in JSON, we can parse and evaluate them safely using a deterministic TypeScript resolver. This completely eliminates execution vulnerabilities, enables serialization, version control, and allows writing visual rule builders for non-developers.

## Consequences
- **Pros**: Secure, serialization-ready, traceably mapped to legal basis records.
- **Cons**: Requires writing a custom resolver for operator evaluations (implemented in `ruleEngine.ts`).
