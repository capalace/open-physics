export type SubjectId = "mechanics" | "electromagnetism" | "waves" | "light" | "thermal" | "modern";

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

export interface SubjectLabDefinition {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly icon: string;
  readonly question: string;
  readonly steps: readonly [string, string, string];
  readonly observe: string;
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
