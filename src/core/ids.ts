/** A random RFC 4122 v4 id: the tables' primary keys are uuids, chosen by the app so related rows can point at each other before they're saved. Not for secrets. */
export function newId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
