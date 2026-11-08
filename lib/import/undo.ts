/** One card whose content was overwritten by an import. */
export type ImportUndoCardSnapshot = {
  id: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  matchKey: string;
};

/** Everything needed to roll back the most recent import. */
export type ImportUndoData = {
  /** Cards created by the import, removed when undoing. */
  insertedIds: string[];
  /** Previous content of the cards updated by the import. */
  updates: ImportUndoCardSnapshot[];
};

/** Lightweight description of the pending undo shown in the UI. */
export type ImportUndoSummary = {
  deckId: string;
  deckName: string;
  inserted: number;
  updated: number;
  createdAt: string;
};

export type ImportUndoGetResponse = {
  undo: ImportUndoSummary | null;
};

export type ImportUndoResponse = {
  ok: true;
  deckName: string;
  deleted: number;
  restored: number;
};
