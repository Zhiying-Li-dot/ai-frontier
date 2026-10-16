const key = "frontier-pages-v1";
function clean(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  for (const [id, entry] of Object.entries(value).slice(0, 1000)) {
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(id) ||
      !entry ||
      typeof entry !== "object"
    )
      continue;
    if (typeof entry.saved !== "boolean" && typeof entry.read !== "boolean")
      continue;
    result[id] = {
      ...(typeof entry.saved === "boolean" ? { saved: entry.saved } : {}),
      ...(typeof entry.read === "boolean" ? { read: entry.read } : {}),
      ...(["too-shallow", "too-deep", "known", "irrelevant", "error"].includes(
        entry.feedback,
      )
        ? { feedback: entry.feedback }
        : {}),
    };
  }
  return result;
}
export function readLocal(storage) {
  try {
    return clean(JSON.parse(storage.getItem(key) || "{}"));
  } catch {
    return {};
  }
}
export function writeLocal(storage, value) {
  try {
    storage.setItem(key, JSON.stringify(clean(value)));
    return true;
  } catch {
    return false;
  }
}
export function clearLocal(storage) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
