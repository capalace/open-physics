import {
  SUBJECT_SANDBOX_TITLE,
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
  "communication",
] as const;

export type WavesLabId = (typeof WAVES_LAB_IDS)[number];

type LabCopy = Omit<SubjectLabDefinition, "graph"> & {
  graph: SubjectLabDefinition["graph"] & { kind: SubjectGraphKind };
};

const termsByLab: Record<WavesLabId, NonNullable<SubjectLabDefinition["terms"]>> = {
  source: [
    { name: "진폭", description: "평형 위치에서 파동이 가장 멀리 벗어난 거리예요." },
    { name: "파원", description: "주기적으로 흔들리며 파동을 처음 만들어 내는 곳이에요." },
    { name: "파동의 세기", description: "파동이 단위 시간과 단위 면적을 지나 전달하는 에너지의 크기예요." },
  ],
  propagation: [
    { name: "파장", description: "모양과 운동 상태가 같은 이웃한 두 지점 사이의 거리예요." },
    { name: "진동수", description: "한 지점이 1초 동안 진동하는 횟수예요." },
    { name: "파동 속력", description: "파동의 모양과 에너지가 매질을 따라 이동하는 빠르기예요." },
  ],
  interference: [
    { name: "중첩", description: "두 파동이 만날 때 각 변위를 더한 모양이 나타나는 원리예요." },
    { name: "보강 간섭", description: "같은 방향의 변위가 만나 진폭이 더 커지는 간섭이에요." },
    { name: "상쇄 간섭", description: "반대 방향의 변위가 만나 진폭이 작아지는 간섭이에요." },
  ],
  "standing-wave": [
    { name: "정상파", description: "서로 반대 방향으로 가는 같은 파동이 겹쳐 제자리에서 진동하는 것처럼 보이는 파동이에요." },
    { name: "마디", description: "정상파에서 항상 변위가 0이라 움직이지 않는 지점이에요." },
    { name: "배", description: "정상파에서 진폭이 가장 큰 지점이에요." },
  ],
  resonance: [
    { name: "공명", description: "외부 진동수가 고유 진동수와 가까울 때 진폭이 크게 커지는 현상이에요." },
    { name: "고유 진동수", description: "외부 힘이 없어도 물체가 스스로 진동하려는 고유한 진동수예요." },
    { name: "강제 진동", description: "주기적인 외부 힘을 받아 그 힘의 진동수로 움직이는 진동이에요." },
  ],
  sound: [
    { name: "종파", description: "매질의 진동 방향과 파동의 진행 방향이 나란한 파동이에요." },
    { name: "압력 변화", description: "공기 입자가 모이고 흩어지며 생기는 압력의 반복적인 차이예요." },
    { name: "소리의 세기", description: "소리가 단위 시간과 단위 면적을 지나 전달하는 에너지의 크기예요." },
  ],
  doppler: [
    { name: "도플러 효과", description: "파원과 관찰자의 상대 운동 때문에 관찰 진동수가 달라지는 현상이에요." },
    { name: "파면", description: "파동의 진동 상태가 같은 지점들을 이은 선이나 면이에요." },
    { name: "관찰 주파수", description: "움직이는 관찰자가 실제로 측정하거나 듣게 되는 진동수예요." },
  ],
  communication: [
    { name: "전자기파", description: "변하는 전기장과 자기장이 공간을 지나며 에너지를 전달하는 파동이에요." },
    { name: "안테나", description: "교류 전기 신호와 전자기파를 서로 바꾸어 주는 장치예요." },
    { name: "반송파", description: "정보를 실어 멀리 전달하도록 일정한 진동수로 만든 전자기파예요." },
  ],
};

const labs: readonly LabCopy[] = ([
  {
    id: "source", title: "파동 만들기", category: "파동의 시작", icon: "〰",
    question: "파원을 더 크게 흔들면 파동의 높이와 에너지는 어떻게 달라질까요?",
    steps: ["주황색 위아래 조절 핸들을 끌어요.", "작은 진폭과 큰 진폭을 번갈아 봐요.", "파형과 상대 세기를 비교해요."],
    observe: "파원의 움직임과 줄의 파고가 같은 진폭으로 바뀌는지 보세요.",
    controls: ["진폭 · 파원이 흔들리는 최대 높이 (cm)"],
    law: { title: "진폭과 세기", description: "파동의 상대 세기는 진폭의 제곱에 비례해 더 빠르게 커져요.", equation: "I ∝ A²" },
    graph: { kind: "waveform", title: "파원 진폭과 파형", xLabel: "거리 (m)", yLabel: "변위 (cm)", series: [{ label: "줄의 변위", color: "#38bdf8" }] },
  },
  {
    id: "propagation", title: "파동의 전파", category: "매질", icon: "➟",
    question: "같은 주파수에서 매질의 파동 속력이 달라지면 파장은 어떻게 변할까요?",
    steps: ["주황색 좌우 조절 핸들을 끌어요.", "느린 매질과 빠른 매질을 번갈아 봐요.", "파면 간격과 그래프를 비교해요."],
    observe: "빠른 매질에서 같은 시간 동안 파면이 더 멀리 가는지 보세요.",
    controls: ["매질 속력 · 파동이 이동하는 속도 (m/s)"],
    law: { title: "파동 속력", description: "주파수가 같으면 파동 속력이 빨라질수록 파장이 길어져요.", equation: "v = fλ" },
    graph: { kind: "line", title: "매질 속력과 파장", xLabel: "속력 (m/s)", yLabel: "파장 (m)", series: [{ label: "파장", color: "#a78bfa" }] },
  },
  {
    id: "interference", title: "중첩과 간섭", category: "두 파원", icon: "◎",
    question: "두 파원의 간격을 바꾸면 보강과 상쇄가 나타나는 곳은 어떻게 이동할까요?",
    steps: ["주황빛으로 강조된 두 번째 파원을 직접 끌어요.", "좁은 간격과 넓은 간격을 번갈아 봐요.", "검출선의 세기 무늬를 비교해요."],
    observe: "두 파가 만나는 곳에서 진폭이 커지거나 거의 사라지는 띠를 보세요.",
    controls: ["파원 간격 · 두 파원 사이 거리 (m)"],
    law: { title: "중첩 원리", description: "두 파가 만난 순간의 변위는 각 파동 변위를 그대로 더한 값이에요.", equation: "y = y₁ + y₂" },
    graph: { kind: "pattern", title: "검출선의 간섭 세기", xLabel: "검출 위치 (m)", yLabel: "상대 세기", series: [{ label: "중첩 세기", color: "#fb923c" }] },
  },
  {
    id: "standing-wave", title: "정상파", category: "경계와 반사", icon: "⋈",
    question: "줄에 들어가는 배음 수를 바꾸면 움직이지 않는 마디는 몇 개가 될까요?",
    steps: ["주황색 좌우 조절 핸들을 끌어요.", "1배음부터 5배음까지 바꿔 봐요.", "마디 위치와 진폭을 비교해요."],
    observe: "양 끝이 고정된 줄에서 움직이지 않는 마디와 크게 흔들리는 배를 찾으세요.",
    controls: ["배음 · 줄 안에 만들어지는 반파장의 개수"],
    law: { title: "고정된 줄의 정상파", description: "줄 길이에 반파장이 정수 개 들어갈 때 정상파가 만들어져요.", equation: "fₙ = nv/(2L)" },
    graph: { kind: "waveform", title: "정상파의 마디와 배", xLabel: "줄의 위치 (m)", yLabel: "진폭 (cm)", series: [{ label: "진폭 포락선", color: "#34d399" }] },
  },
  {
    id: "resonance", title: "공명", category: "진동", icon: "♬",
    question: "구동 주파수를 고유 주파수에 가까이 맞추면 진폭은 얼마나 커질까요?",
    steps: ["주황색 좌우 조절 핸들을 끌어요.", "고유 주파수 근처로 맞춰 봐요.", "공명 곡선의 꼭대기를 찾아요."],
    observe: "주파수가 고유 주파수와 가까워질 때 진동 폭이 크게 커지는지 보세요.",
    controls: ["구동 주파수 · 1초 동안 외부에서 흔드는 횟수 (Hz)"],
    law: { title: "강제 진동과 공명", description: "외부 진동수가 계의 고유 진동수에 가까우면 에너지가 효율적으로 전달돼요.", equation: "f ≈ f₀" },
    graph: { kind: "line", title: "주파수별 공명 응답", xLabel: "구동 주파수 (Hz)", yLabel: "상대 진폭", series: [{ label: "진동 응답", color: "#f472b6" }] },
  },
  {
    id: "sound", title: "소리", category: "압력파", icon: "◖)))",
    question: "스피커의 진폭을 키우면 공기 압력 변화와 소리 세기는 어떻게 달라질까요?",
    steps: ["스피커 옆 주황색 위아래 조절 핸들을 끌어요.", "작은 소리와 큰 소리를 번갈아 봐요.", "마이크 파형과 소리 크기를 비교해요."],
    observe: "공기 입자의 빽빽함과 마이크에 도착한 압력 파형을 함께 보세요.",
    controls: ["소리 진폭 · 공기 압력 변화의 크기 (Pa)"],
    law: { title: "소리의 세기", description: "소리도 파동이므로 진폭이 두 배면 상대 세기는 네 배가 돼요.", equation: "I ∝ A²" },
    graph: { kind: "waveform", title: "마이크의 소리 파형", xLabel: "시간 (ms)", yLabel: "압력 변화 (Pa)", series: [{ label: "마이크 압력", color: "#facc15" }] },
  },
  {
    id: "doppler", title: "도플러 효과", category: "움직이는 파원", icon: "◉→",
    question: "파원이 관찰자 쪽으로 더 빨리 다가가면 들리는 주파수는 얼마나 높아질까요?",
    steps: ["주황빛으로 강조된 파원을 직접 좌우로 끌어요.", "멀어질 때와 다가올 때를 번갈아 봐요.", "파면 간격과 들리는 음을 비교해요."],
    observe: "움직이는 파원 앞쪽 파면은 좁아지고 뒤쪽 파면은 넓어지는지 보세요.",
    controls: ["파원 속도 · 관찰자 방향 이동 속도 (m/s)"],
    law: { title: "도플러 효과", description: "다가오는 파원 앞에서는 파면이 모여 관찰 주파수가 높아져요.", equation: "f′ = fv/(v-vₛ)" },
    graph: { kind: "line", title: "파원 속도와 관찰 주파수", xLabel: "파원 속도 (m/s)", yLabel: "관찰 주파수 (Hz)", series: [{ label: "관찰 주파수", color: "#fb7185" }] },
  },
  {
    id: "communication", title: "전자기파 통신", category: "정보 통신", icon: "⌁",
    question: "송신 안테나의 진동수를 바꾸면 전자기파의 파장과 수신 신호는 어떻게 달라질까요?",
    steps: ["주황색 좌우 조절 핸들을 끌어요.", "낮은 값과 높은 값을 번갈아 봐요.", "파면 간격과 수신 신호를 비교해요."],
    observe: "진동수가 높아질수록 파면 간격이 좁아지고 수신 안테나의 전하도 같은 진동수로 움직이는지 보세요.",
    controls: ["반송파 진동수 · 1초 동안 안테나 전류가 진동하는 횟수 (MHz)"],
    law: { title: "전자기파의 속력", description: "진공에서 전자기파 속력은 일정하므로 진동수가 높을수록 파장이 짧아져요.", equation: "c = fλ" },
    graph: { kind: "line", title: "반송파 진동수와 파장", xLabel: "진동수 (MHz)", yLabel: "파장 (m)", series: [{ label: "전자기파 파장", color: "#22d3ee" }] },
  },
] satisfies readonly LabCopy[]).map((definition) => ({ ...definition, terms: termsByLab[definition.id as WavesLabId] }));

export const wavesDefinition: SubjectDefinition = {
  id: "waves",
  label: "파동",
  eyebrow: "파동",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "파원, 줄과 매질, 경계, 관찰자를 직접 놓아 파동 실험을 만들어요.",
  labs,
};

validateSubjectDefinition(wavesDefinition, WAVES_LAB_IDS);
