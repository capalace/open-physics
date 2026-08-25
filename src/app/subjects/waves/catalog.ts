import {
  validateSubjectDefinition,
  type SubjectDefinition,
  type SubjectGraphKind,
  type SubjectLabDefinition,
} from "../subject-experience";

export const WAVES_LAB_IDS = [
  "source",
  "propagation",
  "interference",
  "standing-wave",
  "resonance",
  "sound",
  "doppler",
] as const;

export type WavesLabId = (typeof WAVES_LAB_IDS)[number];

type LabCopy = Omit<SubjectLabDefinition, "graph"> & {
  graph: SubjectLabDefinition["graph"] & { kind: SubjectGraphKind };
};

const labs: readonly LabCopy[] = [
  {
    id: "source", title: "파동 만들기", category: "파동의 시작", icon: "〰",
    question: "파원을 더 크게 흔들면 파동의 높이와 에너지는 어떻게 달라질까요?",
    steps: ["파란 파원 손잡이를 잡아요.", "위아래로 흔드는 크기를 바꿔요.", "파형과 상대 세기를 비교해요."],
    observe: "파원의 움직임과 줄의 파고가 같은 진폭으로 바뀌는지 보세요.",
    controls: ["진폭 손잡이 · 파원이 흔들리는 최대 높이 (cm)"],
    law: { title: "진폭과 세기", description: "파동의 상대 세기는 진폭의 제곱에 비례해 더 빠르게 커져요.", equation: "I ∝ A²" },
    graph: { kind: "waveform", title: "파원 진폭과 파형", xLabel: "거리 (m)", yLabel: "변위 (cm)", series: [{ label: "줄의 변위", color: "#38bdf8" }] },
  },
  {
    id: "propagation", title: "파동의 전파", category: "매질", icon: "➟",
    question: "같은 주파수에서 매질의 파동 속력이 달라지면 파장은 어떻게 변할까요?",
    steps: ["보라색 매질 손잡이를 잡아요.", "좌우로 옮겨 속력을 바꿔요.", "파면 간격과 그래프를 비교해요."],
    observe: "빠른 매질에서 같은 시간 동안 파면이 더 멀리 가는지 보세요.",
    controls: ["매질 속력 · 파동이 이동하는 속도 (m/s)"],
    law: { title: "파동 속력", description: "주파수가 같으면 파동 속력이 빨라질수록 파장이 길어져요.", equation: "v = fλ" },
    graph: { kind: "line", title: "매질 속력과 파장", xLabel: "속력 (m/s)", yLabel: "파장 (m)", series: [{ label: "파장", color: "#a78bfa" }] },
  },
  {
    id: "interference", title: "중첩과 간섭", category: "두 파원", icon: "◎",
    question: "두 파원의 간격을 바꾸면 보강과 상쇄가 나타나는 곳은 어떻게 이동할까요?",
    steps: ["아래쪽 주황 파원을 잡아요.", "위아래로 옮겨 간격을 바꿔요.", "검출선의 세기 무늬를 비교해요."],
    observe: "두 파가 만나는 곳에서 진폭이 커지거나 거의 사라지는 띠를 보세요.",
    controls: ["파원 간격 · 두 파원 사이 거리 (m)"],
    law: { title: "중첩 원리", description: "두 파가 만난 순간의 변위는 각 파동 변위를 그대로 더한 값이에요.", equation: "y = y₁ + y₂" },
    graph: { kind: "pattern", title: "검출선의 간섭 세기", xLabel: "검출 위치 (m)", yLabel: "상대 세기", series: [{ label: "중첩 세기", color: "#fb923c" }] },
  },
  {
    id: "standing-wave", title: "정상파", category: "경계와 반사", icon: "⋈",
    question: "줄에 들어가는 배음 수를 바꾸면 움직이지 않는 마디는 몇 개가 될까요?",
    steps: ["초록색 배음 손잡이를 잡아요.", "좌우로 움직여 배음을 바꿔요.", "마디 위치와 진폭을 비교해요."],
    observe: "양 끝이 고정된 줄에서 움직이지 않는 마디와 크게 흔들리는 배를 찾으세요.",
    controls: ["배음 · 줄 안에 만들어지는 반파장의 개수"],
    law: { title: "고정된 줄의 정상파", description: "줄 길이에 반파장이 정수 개 들어갈 때 정상파가 만들어져요.", equation: "fₙ = nv/(2L)" },
    graph: { kind: "waveform", title: "정상파의 마디와 배", xLabel: "줄의 위치 (m)", yLabel: "진폭 (cm)", series: [{ label: "진폭 포락선", color: "#34d399" }] },
  },
  {
    id: "resonance", title: "공명", category: "진동", icon: "♬",
    question: "구동 주파수를 고유 주파수에 가까이 맞추면 진폭은 얼마나 커질까요?",
    steps: ["분홍색 주파수 손잡이를 잡아요.", "좌우로 옮겨 주파수를 맞춰요.", "공명 곡선의 꼭대기를 찾아요."],
    observe: "주파수가 고유 주파수와 가까워질 때 진동 폭이 크게 커지는지 보세요.",
    controls: ["구동 주파수 · 1초 동안 외부에서 흔드는 횟수 (Hz)"],
    law: { title: "강제 진동과 공명", description: "외부 진동수가 계의 고유 진동수에 가까우면 에너지가 효율적으로 전달돼요.", equation: "f ≈ f₀" },
    graph: { kind: "line", title: "주파수별 공명 응답", xLabel: "구동 주파수 (Hz)", yLabel: "상대 진폭", series: [{ label: "진동 응답", color: "#f472b6" }] },
  },
  {
    id: "sound", title: "소리", category: "압력파", icon: "◖)))",
    question: "스피커의 진폭을 키우면 공기 압력 변화와 소리 세기는 어떻게 달라질까요?",
    steps: ["스피커의 노란 손잡이를 잡아요.", "위아래로 움직여 진폭을 바꿔요.", "마이크 파형과 소리 크기를 비교해요."],
    observe: "공기 입자의 빽빽함과 마이크에 도착한 압력 파형을 함께 보세요.",
    controls: ["소리 진폭 · 공기 압력 변화의 크기 (Pa)"],
    law: { title: "소리의 세기", description: "소리도 파동이므로 진폭이 두 배면 상대 세기는 네 배가 돼요.", equation: "I ∝ A²" },
    graph: { kind: "waveform", title: "마이크의 소리 파형", xLabel: "시간 (ms)", yLabel: "압력 변화 (Pa)", series: [{ label: "마이크 압력", color: "#facc15" }] },
  },
  {
    id: "doppler", title: "도플러 효과", category: "움직이는 파원", icon: "◉→",
    question: "파원이 관찰자 쪽으로 더 빨리 다가가면 들리는 주파수는 얼마나 높아질까요?",
    steps: ["빨간 파원 손잡이를 잡아요.", "관찰자 쪽으로 끌어 속도를 정해요.", "파면 간격과 들리는 음을 비교해요."],
    observe: "움직이는 파원 앞쪽 파면은 좁아지고 뒤쪽 파면은 넓어지는지 보세요.",
    controls: ["파원 속도 · 관찰자 방향 이동 속도 (m/s)"],
    law: { title: "도플러 효과", description: "다가오는 파원 앞에서는 파면이 모여 관찰 주파수가 높아져요.", equation: "f′ = fv/(v-vₛ)" },
    graph: { kind: "line", title: "파원 속도와 관찰 주파수", xLabel: "파원 속도 (m/s)", yLabel: "관찰 주파수 (Hz)", series: [{ label: "관찰 주파수", color: "#fb7185" }] },
  },
];

export const wavesDefinition: SubjectDefinition = {
  id: "waves",
  label: "파동",
  eyebrow: "WAVES LAB",
  sandboxTitle: "빈 파동 실험실 만들기",
  sandboxDescription: "파원, 줄과 매질, 경계, 관찰자를 직접 놓아 파동 실험을 만들어요.",
  labs,
};

validateSubjectDefinition(wavesDefinition, WAVES_LAB_IDS);
