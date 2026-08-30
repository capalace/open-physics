import type { SubjectExperience, SubjectHosts, SubjectId } from "./subjects/subject-experience";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

installProgressiveWebApp();

const SUBJECT_IDS: readonly SubjectId[] = [
  "mechanics",
  "electromagnetism",
  "waves",
  "light",
  "thermal",
  "modern",
];

const requestedSubject = new URL(window.location.href).searchParams.get("subject");
const activeSubject: SubjectId = SUBJECT_IDS.includes(requestedSubject as SubjectId)
  ? requestedSubject as SubjectId
  : "mechanics";

document.body.dataset.subject = activeSubject;

if (activeSubject === "mechanics") {
  await import("./mechanics-main");
  document.body.dataset.appReady = "true";
} else {
  const experience = await loadExperience(activeSubject);
  if (!experience) {
    const url = new URL(window.location.href);
    url.searchParams.delete("subject");
    window.location.replace(url);
  } else {
    const hosts: SubjectHosts = {
      experimentPanel: required<HTMLElement>("#experiment-panel"),
      workspace: required<HTMLElement>(".workspace"),
      inspectorPanel: required<HTMLElement>("#inspector-panel"),
    };
    hosts.experimentPanel.setAttribute("aria-label", `${experience.definition.label} 실험 선택`);
    hosts.workspace.setAttribute("aria-label", `${experience.definition.label} 물리 월드`);
    const controller = experience.mount(hosts);
    const uninstallFocusMode = installSubjectFocusMode(hosts, controller);
    controller.resize();
    document.body.dataset.appReady = "true";
    const resize = () => controller.resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pagehide", (event) => {
      if (event.persisted) return;
      window.removeEventListener("resize", resize);
      uninstallFocusMode();
      controller.unmount();
    });
  }
}

async function loadExperience(subject: SubjectId): Promise<SubjectExperience | null> {
  if (subject === "electromagnetism") return (await import("./subjects/electromagnetism")).electromagnetismExperience;
  if (subject === "waves") return (await import("./subjects/waves")).wavesExperience;
  if (subject === "light") return (await import("./subjects/light")).lightExperience;
  if (subject === "thermal") return (await import("./subjects/thermal/experience")).thermalExperience;
  if (subject === "modern") return (await import("./subjects/modern")).modernExperience;
  return null;
}

function installSubjectFocusMode(hosts: SubjectHosts, controller: { resize(): void }): () => void {
  const toolbar = hosts.workspace.querySelector<HTMLElement>(".world-toolbar");
  const appLayout = document.querySelector<HTMLElement>(".app-layout");
  if (!toolbar || !appLayout) return () => undefined;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button text-button focus-button";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-controls", "experiment-panel inspector-panel");
  const setFocusMode = (enabled: boolean): void => {
    appLayout.classList.toggle("is-focus-mode", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "▦ 설정 보기" : "⛶ 크게 보기";
    button.title = enabled ? "설정 패널 다시 열기 (Esc)" : "설정 패널을 접고 실험 공간 크게 보기";
    requestAnimationFrame(() => controller.resize());
  };
  button.addEventListener("click", () => setFocusMode(!appLayout.classList.contains("is-focus-mode")));
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape" && appLayout.classList.contains("is-focus-mode")) setFocusMode(false);
  };
  document.addEventListener("keydown", onKeyDown);
  toolbar.append(button);
  setFocusMode(false);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    appLayout.classList.remove("is-focus-mode");
    button.remove();
  };
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element;
}

function installProgressiveWebApp(): void {
  const button = document.querySelector<HTMLButtonElement>("#pwa-install");
  let promptEvent: BeforeInstallPromptEvent | null = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event as BeforeInstallPromptEvent;
    if (button) button.hidden = false;
  });

  button?.addEventListener("click", async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") button.hidden = true;
    promptEvent = null;
  });

  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    if (button) button.hidden = true;
  });

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
    });
  }
}
