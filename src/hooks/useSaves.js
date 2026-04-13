import { useState, useEffect } from "react";
import { listSaves as idbListSaves, saveGame as idbSaveGame, deleteSave as idbDeleteSave } from "./useIndexedDB";

export function useSaves() {
  const [saves, setSaves] = useState([]);

  const refreshSaves = async () => {
    const all = await idbListSaves();
    setSaves(all);
  };

  useEffect(() => { refreshSaves(); }, []);

  const saveGame = async ({ storyId, storyTitle, snapshot }) => {
    const lastMeaningful = [...snapshot.entries].reverse()
      .find((e) => e.source !== "continue" && e.source !== "compact" && e.source !== "compacting");
    const previewText = (lastMeaningful?.text ?? "").slice(0, 150);
    await idbSaveGame({
      id: crypto.randomUUID(),
      storyId,
      storyTitle,
      savedAt: Date.now(),
      previewText,
      snapshot,
    });
    await refreshSaves();
  };

  const deleteSave = async (id) => {
    await idbDeleteSave(id);
    await refreshSaves();
  };

  return { saves, saveGame, deleteSave };
}
