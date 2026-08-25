import {
  validateSubjectDefinition,
  type SubjectDefinition,
  type SubjectLabDefinition,
} from "../subject-experience";

export const ELECTROMAGNETISM_LAB_IDS = [
  "charge",
  "electric-field",
  "potential",
  "circuits",
  "capacitors",
  "magnetic-field",
  "electromagnetic-force",
  "induction",
] as const;

export type ElectromagnetismLabId = typeof ELECTROMAGNETISM_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

export const ELECTROMAGNETISM_LABS: readonly SubjectLabDefinition[] = [
  lab({
    id: "charge", title: "전하는 언제 밀고 당길까?", category: "전하와 전기", icon: "⊕",
    question: "두 전하의 부호와 거리를 바꾸면 힘의 방향과 크기는 어떻게 달라질까요?",
    steps: ["파란 전하를 잡아 옮겨요.", "전하의 부호를 바꾸어 보세요.", "힘 화살표와 그래프를 비교해요."],
    observe: "같은 부호는 밀고 다른 부호는 당기며, 가까워질수록 힘이 빠르게 커지는지 보세요.",
    controls: ["charge-sign", "charge-size"],
    law: { title: "쿨롱 힘", description: "두 전하 사이 힘은 전하량의 곱에 비례하고 거리의 제곱에 반비례합니다.", equation: "F = kq₁q₂/r²" },
    graph: { kind: "line", title: "전하 사이 거리와 힘", xLabel: "거리 (m)", yLabel: "힘 (N)", series: [{ label: "전기력", color: "#e05c3f" }] },
  }),
  lab({
    id: "electric-field", title: "보이지 않는 전기장은 어디로 향할까?", category: "전하와 전기", icon: "✦",
    question: "탐침을 전하 주변으로 옮기면 전기장의 방향과 세기는 어떻게 달라질까요?",
    steps: ["초록 탐침을 장 안에서 움직여요.", "양전하와 음전하 사이를 지나가요.", "장 화살표와 세기 그래프를 비교해요."],
    observe: "여러 전하가 만든 장이 더해져 위치마다 방향과 세기가 달라지는 모습을 보세요.",
    controls: ["probe-position", "source-charge"],
    law: { title: "전기장과 중첩", description: "각 전하가 만든 전기장 벡터를 더하면 그 위치의 전체 전기장이 됩니다.", equation: "E = Σkq r̂/r²" },
    graph: { kind: "line", title: "탐침 위치의 전기장", xLabel: "가로 위치 (m)", yLabel: "전기장 (N/C)", series: [{ label: "전체 전기장", color: "#25a77a" }] },
  }),
  lab({
    id: "potential", title: "전위가 같은 곳은 어떤 모양일까?", category: "전하와 전기", icon: "V",
    question: "탐침을 옮기면 전위와 전기 위치 에너지는 어떻게 달라질까요?",
    steps: ["보라색 전위 탐침을 옮겨요.", "등전위선 안과 밖을 지나가요.", "전위 값과 그래프를 비교해요."],
    observe: "전위는 방향이 없는 값이며 같은 전위의 점들이 선을 이루는지 보세요.",
    controls: ["probe-position", "test-charge"],
    law: { title: "전위와 위치 에너지", description: "점전하의 전위는 거리에 반비례하고 시험 전하의 위치 에너지는 qV입니다.", equation: "V = kq/r · U = qV" },
    graph: { kind: "line", title: "거리와 전위", xLabel: "전하에서 거리 (m)", yLabel: "전위 (V)", series: [{ label: "전위", color: "#a069dc" }] },
  }),
  lab({
    id: "circuits", title: "전구를 더 밝게 하려면 무엇을 바꿀까?", category: "회로와 저장", icon: "⏻",
    question: "전지의 전압과 저항을 바꾸면 회로의 전류와 밝기는 어떻게 달라질까요?",
    steps: ["전지 손잡이를 끌어 전압을 바꿔요.", "저항 블록을 길게 또는 짧게 바꿔요.", "전류 흐름과 전력 그래프를 비교해요."],
    observe: "전압이 높거나 저항이 작을수록 전류와 전구의 전력이 커지는지 보세요.",
    controls: ["voltage", "resistance"],
    law: { title: "옴의 법칙과 전력", description: "전류는 전압에 비례하고 저항에 반비례하며 전력은 전압과 전류의 곱입니다.", equation: "V = IR · P = VI" },
    graph: { kind: "line", title: "저항과 전류", xLabel: "저항 (Ω)", yLabel: "전류 (A)", series: [{ label: "전류", color: "#f2b84b" }] },
  }),
  lab({
    id: "capacitors", title: "축전기는 어떻게 전하를 더 담을까?", category: "회로와 저장", icon: "▮▯",
    question: "두 판의 거리와 전압을 바꾸면 저장되는 전하와 에너지는 어떻게 달라질까요?",
    steps: ["오른쪽 금속판을 끌어 간격을 바꿔요.", "전압 단계를 바꾸어 충전해요.", "판 사이 장과 저장 에너지를 비교해요."],
    observe: "판이 가까울수록 같은 전압에서 더 많은 전하를 저장하는지 보세요.",
    controls: ["plate-separation", "voltage"],
    law: { title: "평행판 축전기", description: "판 면적이 같다면 간격이 작을수록 전기용량이 커지고 더 많은 에너지를 저장합니다.", equation: "C = εA/d · U = ½CV²" },
    graph: { kind: "line", title: "판 간격과 전기용량", xLabel: "판 간격 (mm)", yLabel: "전기용량 (nF)", series: [{ label: "전기용량", color: "#5b7cfa" }] },
  }),
  lab({
    id: "magnetic-field", title: "전류 주변의 자기장은 어떻게 감길까?", category: "자기와 유도", icon: "⊙",
    question: "전류의 세기와 방향을 바꾸면 도선 주변 자기장은 어떻게 달라질까요?",
    steps: ["탐침을 도선 주변으로 옮겨요.", "전류의 방향을 뒤집어 보세요.", "나침반 방향과 장 세기를 비교해요."],
    observe: "자기장이 도선을 중심으로 원을 이루고 전류가 뒤집히면 방향도 뒤집히는지 보세요.",
    controls: ["current", "probe-position"],
    law: { title: "전류가 만드는 자기장", description: "긴 직선 도선의 자기장은 전류에 비례하고 도선에서 거리에 반비례합니다.", equation: "B = μ₀I/(2πr)" },
    graph: { kind: "line", title: "도선에서 거리와 자기장", xLabel: "거리 (cm)", yLabel: "자기장 (μT)", series: [{ label: "자기장", color: "#25a77a" }] },
  }),
  lab({
    id: "electromagnetic-force", title: "자기장 속 전하는 어느 쪽으로 휠까?", category: "자기와 유도", icon: "↷",
    question: "전하의 속도 방향을 바꾸면 자기력이 만드는 궤도는 어떻게 달라질까요?",
    steps: ["속도 화살표 끝을 끌어 방향을 정해요.", "전하를 발사해 휘는 길을 봐요.", "전하 부호와 자기장 방향을 뒤집어 비교해요."],
    observe: "자기력이 속도와 직각으로 작용하고 부호가 바뀌면 휘는 방향도 바뀌는지 보세요.",
    controls: ["velocity", "charge-sign", "magnetic-direction"],
    law: { title: "로런츠 힘", description: "움직이는 전하는 속도와 자기장 모두에 수직인 힘을 받아 진행 방향이 휘어집니다.", equation: "F = q(v × B)" },
    graph: { kind: "line", title: "속도 방향과 자기력", xLabel: "속도 각도 (°)", yLabel: "자기력 (상대값)", series: [{ label: "자기력", color: "#e05c3f" }] },
  }),
  lab({
    id: "induction", title: "자석을 얼마나 빨리 움직여야 전기가 생길까?", category: "자기와 유도", icon: "⌁",
    question: "자석의 속도와 코일 감은 수를 바꾸면 유도 전압은 어떻게 달라질까요?",
    steps: ["자석을 코일 안팎으로 끌어 움직여요.", "같은 거리를 더 빠르게 움직여요.", "코일 감은 수와 전압 그래프를 비교해요."],
    observe: "자속이 빠르게 변할수록 더 큰 전압이 생기고 움직임이 멈추면 전압도 0이 되는지 보세요.",
    controls: ["magnet-position", "coil-turns"],
    law: { title: "패러데이 전자기 유도", description: "코일을 지나는 자기선속이 변할 때 그 변화를 방해하는 방향으로 전압이 생깁니다.", equation: "ε = −NΔΦ/Δt" },
    graph: { kind: "line", title: "자석 속도와 유도 전압", xLabel: "자석 속도 (m/s)", yLabel: "유도 전압 (V)", series: [{ label: "유도 전압", color: "#a069dc" }] },
  }),
];

export const ELECTROMAGNETISM_SUBJECT: SubjectDefinition = {
  id: "electromagnetism",
  label: "전자기학",
  eyebrow: "ELECTROMAGNETISM LAB",
  sandboxTitle: "빈 전자기 실험실 만들기",
  sandboxDescription: "전하·회로·자석·코일과 탐침을 자유롭게 조합해요.",
  labs: ELECTROMAGNETISM_LABS,
};

validateSubjectDefinition(ELECTROMAGNETISM_SUBJECT, ELECTROMAGNETISM_LAB_IDS);

export function electromagnetismLab(id: string): SubjectLabDefinition {
  const found = ELECTROMAGNETISM_LABS.find((candidate) => candidate.id === id);
  if (!found) throw new RangeError(`Unknown electromagnetism lab: ${id}`);
  return found;
}
