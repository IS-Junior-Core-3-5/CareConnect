import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { parents, type Schedule } from "@/data/mock";

type AppState = {
  parentName: string;
  language: string;
  schedule: Schedule;
  favorites: string[];
  connections: string[];
  setParentName: (v: string) => void;
  setLanguage: (v: string) => void;
  setSchedule: (s: Schedule) => void;
  toggleBlock: (day: number, block: number) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleConnection: (id: string) => void;
  isConnected: (id: string) => boolean;
};

const me = parents[0];

const Ctx = createContext<AppState | null>(null);

const KEY = "careconnect-demo-v1";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [parentName, setParentName] = useState(me.name);
  const [language, setLanguage] = useState(me.language);
  const [schedule, setSchedule] = useState<Schedule>(me.schedule.map((r) => [...r]));
  const [favorites, setFavorites] = useState<string[]>(["maya-okafor", "sunny-meadows", "little-lantern"]);
  const [connections, setConnections] = useState<string[]>(["p-luis"]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.parentName) setParentName(saved.parentName);
      if (saved.language) setLanguage(saved.language);
      if (saved.schedule) setSchedule(saved.schedule);
      if (saved.favorites) setFavorites(saved.favorites);
      if (saved.connections) setConnections(saved.connections);
    } catch {
      /* demo only */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ parentName, language, schedule, favorites, connections }),
      );
    } catch {
      /* demo only */
    }
  }, [parentName, language, schedule, favorites, connections]);

  const toggleBlock = useCallback((day: number, block: number) => {
    setSchedule((prev) =>
      prev.map((row, d) => (d === day ? row.map((v, t) => (t === block ? !v : v)) : row)),
    );
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleConnection = useCallback((id: string) => {
    setConnections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      parentName,
      language,
      schedule,
      favorites,
      connections,
      setParentName,
      setLanguage,
      setSchedule,
      toggleBlock,
      toggleFavorite,
      isFavorite: (id) => favorites.includes(id),
      toggleConnection,
      isConnected: (id) => connections.includes(id),
    }),
    [parentName, language, schedule, favorites, connections, toggleBlock, toggleFavorite, toggleConnection],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
