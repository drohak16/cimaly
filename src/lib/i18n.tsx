import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { T, type Lang, type Genre, type Country } from "./catalog";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (k: string) => string;
};

const LangContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
  t: (k) => T.en[k] ?? k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("cimaly.lang");
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("cimaly.lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((k: string) => T[lang]?.[k] || T.en[k] || k, [lang]);

  return (
    <LangContext.Provider
      value={{ lang, setLang, toggleLang: () => setLang(lang === "en" ? "ar" : "en"), t }}
    >
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
export const gname = (g: Genre, lang: Lang) => (lang === "ar" ? g.ar : g.en);
export const cname = (c: Country, lang: Lang) => (lang === "ar" ? c.ar : c.en);