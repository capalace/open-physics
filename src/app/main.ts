import type { SubjectExperience, SubjectHosts, SubjectId } from "./subjects/subject-experience";
import "./subjects/style.css";

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
document.querySelectorAll<HTMLButtonElement>("button[data-subject]").forEach((button) => {
  const subject = button.dataset.subject as SubjectId;
  const selected = subject === activeSubject;
  button.classList.toggle("is-active", selected);
  button.setAttribute("aria-pressed", String(selected));
  button.addEventListener("click", () => {
    if (subject === activeSubject) return;
    const url = new URL(window.location.href);
    if (subject === "mechanics") url.searchParams.delete("subject");
    else url.searchParams.set("subject", subject);
    window.location.assign(url);
  });
});

if (activeSubject === "mechanics") {
  await import("./mechanics-main");
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
    controller.resize();
    const resize = () => controller.resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pagehide", (event) => {
      if (event.persisted) return;
      window.removeEventListener("resize", resize);
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

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element;
}
