/** Result of an editorial server action, rendered by the form that called it. */
export type ActionState = {
  ok?: true;
  /** Safe to show to a signed-in editor. Database rule violations arrive here verbatim. */
  error?: string;
  /** The record changed since it was loaded; the form offers a reload. */
  stale?: boolean;
  fieldErrors?: Readonly<Record<string, string>>;
  /** Echoed back so a rejected form keeps what the editor typed. */
  values?: Readonly<Record<string, string>>;
};

export const INITIAL_ACTION_STATE: ActionState = {};
