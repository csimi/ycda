const modules = import.meta.glob("../../stories/*.json", { eager: true });

export const builtinStories = Object.values(modules).map((m) => m.default ?? m);
