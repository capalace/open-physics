export type SubjectId = "mechanics" | "electromagnetism" | "waves" | "light" | "thermal" | "modern";

export const SUBJECT_SANDBOX_TITLE = "빈 실험실 만들기";

export type SubjectGraphKind = "line" | "waveform" | "spectrum" | "distribution" | "pattern" | "pv";

export interface SubjectGraphSeries {
  readonly label: string;
  readonly color: string;
}

export interface SubjectGraphDefinition {
  readonly kind: SubjectGraphKind;
  readonly title: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly series: readonly SubjectGraphSeries[];
}

export interface PhysicsTermDefinition {
  readonly name: string;
  readonly description: string;
}

export interface SubjectLabDefinition {
  readonly id: string;
  readonly title: string;
  readonly selectionTitle?: string;
  readonly selectionDescription?: string;
  readonly category: string;
  readonly icon: string;
  readonly question: string;
  readonly steps: readonly [string, string, string];
  readonly observe: string;
  readonly terms?: readonly PhysicsTermDefinition[];
  readonly controls: readonly string[];
  readonly law: {
    readonly title: string;
    readonly description: string;
    readonly equation: string;
  };
  readonly graph: SubjectGraphDefinition;
}

export interface SubjectDefinition {
  readonly id: SubjectId;
  readonly label: string;
  readonly eyebrow: string;
  readonly sandboxTitle: string;
  readonly sandboxDescription: string;
  readonly labs: readonly SubjectLabDefinition[];
}

export interface SubjectHosts {
  readonly experimentPanel: HTMLElement;
  readonly workspace: HTMLElement;
  readonly inspectorPanel: HTMLElement;
}

export interface SubjectController {
  resize(): void;
  unmount(): void;
}

export type SubjectRoute =
  | { readonly screen: "selection" }
  | { readonly screen: "lab"; readonly labId: string };

export type SubjectRouteSource = "initial" | "navigation" | "history";

type SubjectRouteDefinition = {
  readonly id: SubjectId;
  readonly labs: readonly { readonly id: string }[];
};

/** Parses a subject's URL state without leaking browser history concerns into physics models. */
export function subjectRouteFromUrl(url: URL, definition: SubjectRouteDefinition): SubjectRoute {
  if (url.searchParams.get("view") === "selection") return { screen: "selection" };
  const requestedLab = url.searchParams.get("lab");
  if (!requestedLab) return { screen: "lab", labId: "sandbox" };
  if (requestedLab === "sandbox" || definition.labs.some((lab) => lab.id === requestedLab)) {
    return { screen: "lab", labId: requestedLab };
  }
  return { screen: "selection" };
}

/** Builds canonical, static-host-safe URLs for selection and dedicated lab screens. */
export function subjectRouteUrl(currentUrl: URL, definition: SubjectRouteDefinition, route: SubjectRoute): URL {
  const next = new URL(currentUrl);
  if (definition.id === "mechanics") next.searchParams.delete("subject");
  else next.searchParams.set("subject", definition.id);
  if (route.screen === "lab") {
    next.searchParams.delete("view");
    next.searchParams.set("lab", route.labId);
  } else {
    next.searchParams.delete("lab");
    next.searchParams.set("view", "selection");
  }
  return next;
}

interface SubjectRouteSessionOptions {
  readonly definition: SubjectRouteDefinition;
  readonly onRoute: (route: SubjectRoute, source: SubjectRouteSource) => void;
}

/** Owns browser history for a subject while keeping routing out of its physics model. */
export class SubjectRouteSession {
  private started = false;

  constructor(private readonly options: SubjectRouteSessionOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener("popstate", this.handlePopState);
    this.sync("initial");
  }

  openLab(labId: string): void {
    const route: SubjectRoute = { screen: "lab", labId };
    const url = subjectRouteUrl(new URL(window.location.href), this.options.definition, route);
    window.history.pushState({ ...window.history.state, openPhysicsLabRoute: this.options.definition.id }, "", url);
    this.options.onRoute(route, "navigation");
  }

  returnToSelection(): void {
    if (window.history.state?.openPhysicsLabRoute === this.options.definition.id) {
      window.history.back();
      return;
    }
    const route: SubjectRoute = { screen: "selection" };
    const url = subjectRouteUrl(new URL(window.location.href), this.options.definition, route);
    window.history.replaceState(window.history.state, "", url);
    this.options.onRoute(route, "history");
  }

  dispose(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("popstate", this.handlePopState);
  }

  private readonly handlePopState = (): void => this.sync("history");

  private sync(source: SubjectRouteSource): void {
    const currentUrl = new URL(window.location.href);
    const route = subjectRouteFromUrl(currentUrl, this.options.definition);
    if (route.screen === "selection" && currentUrl.searchParams.has("lab")) {
      window.history.replaceState(
        window.history.state,
        "",
        subjectRouteUrl(currentUrl, this.options.definition, route),
      );
    }
    this.options.onRoute(route, source);
  }
}

/** Deep module seam used by the app shell to activate one complete physics subject. */
export interface SubjectExperience {
  readonly definition: SubjectDefinition;
  mount(hosts: SubjectHosts): SubjectController;
}

/** Shared catalog invariants; subject-specific behavior remains inside each subject module. */
export function validateSubjectDefinition(
  definition: SubjectDefinition,
  expectedLabIds: readonly string[],
): void {
  if (definition.sandboxTitle !== SUBJECT_SANDBOX_TITLE) {
    throw new RangeError(`${definition.id} must use the shared empty-lab title.`);
  }
  if (definition.labs.length !== expectedLabIds.length) {
    throw new RangeError(`${definition.id} must define ${expectedLabIds.length} guided labs.`);
  }
  const ids = definition.labs.map((lab) => lab.id);
  if (new Set(ids).size !== ids.length || expectedLabIds.some((id) => !ids.includes(id))) {
    throw new RangeError(`${definition.id} guided lab ids must match the subject guideline.`);
  }
  const questions = new Set<string>();
  const graphTitles = new Set<string>();
  for (const lab of definition.labs) {
    if (lab.steps.length !== 3 || lab.steps.some((step) => step.trim().length < 8)) {
      throw new RangeError(`${definition.id}/${lab.id} must provide three actionable steps.`);
    }
    if (lab.question.trim().length < 10 || questions.has(lab.question)) {
      throw new RangeError(`${definition.id}/${lab.id} must provide a distinct inquiry question.`);
    }
    if (lab.observe.trim().length < 10 || lab.controls.length === 0) {
      throw new RangeError(`${definition.id}/${lab.id} must provide an observation and controls.`);
    }
    if (!lab.terms || lab.terms.length < 3 || lab.terms.some((term) => term.name.trim().length < 1 || term.description.trim().length < 10)) {
      throw new RangeError(`${definition.id}/${lab.id} must explain at least three experiment-specific terms.`);
    }
    if (
      lab.law.title.trim().length < 2
      || lab.law.description.trim().length < 10
      || lab.law.equation.trim().length < 2
    ) {
      throw new RangeError(`${definition.id}/${lab.id} must explain its physical law.`);
    }
    if (
      lab.graph.title.trim().length < 2
      || lab.graph.xLabel.trim().length < 2
      || lab.graph.yLabel.trim().length < 2
      || lab.graph.series.length === 0
      || graphTitles.has(lab.graph.title)
    ) {
      throw new RangeError(`${definition.id}/${lab.id} must provide a distinct measurable graph.`);
    }
    questions.add(lab.question);
    graphTitles.add(lab.graph.title);
  }
}
