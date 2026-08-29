import {
  SUBJECT_SANDBOX_TITLE,
  validateSubjectDefinition,
  type SubjectDefinition,
  type SubjectLabDefinition,
} from "../subject-experience";

export const ELECTROMAGNETISM_LAB_IDS = [
  "charge",
  "circuits",
  "capacitors",
  "electromagnetic-force",
  "induction",
  "electromagnet",
  "motor",
  "generator",
  "transformer",
] as const;

export type ElectromagnetismLabId = typeof ELECTROMAGNETISM_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

export const ELECTROMAGNETISM_LABS: readonly SubjectLabDefinition[] = [
  lab({
    id: "charge", title: "전하는 어떻게 밀고 당길까?", category: "전하와 전기", icon: "⊕",
    selectionTitle: "전하와 전기력", selectionDescription: "같은 전하는 밀고 다른 전하는 당길까?",
    question: "두 전하의 부호와 거리를 바꾸면 전기력과 주변 전기장은 어떻게 달라질까요?",
    steps: ["파란 전하를 잡아 옮겨요.", "전하의 부호를 바꾸어 보세요.", "힘 화살표와 주변 전기력선을 함께 비교해요."],
    observe: "같은 부호는 밀고 다른 부호는 당기며, 전기력선은 양전하에서 나와 음전하로 향하는지 보세요.",
    terms: [
      { name: "전하", description: "전기적인 힘을 주고받게 하는 물질의 성질이에요." },
      { name: "전기력", description: "전하 사이에서 서로 밀거나 당기는 힘이에요." },
      { name: "전기장", description: "전하가 주변의 다른 전하에 힘을 줄 수 있는 공간이에요." },
    ],
    controls: ["charge-sign", "charge-size"],
    law: { title: "쿨롱 힘과 전기장", description: "두 전하 사이 힘은 거리의 제곱에 반비례하고, 전기장은 양전하가 밀어내는 방향으로 정의합니다.", equation: "F = kq₁q₂/r² · E = F/q" },
    graph: { kind: "line", title: "전하 사이 거리와 힘", xLabel: "거리 (m)", yLabel: "힘 (N)", series: [{ label: "전기력", color: "#e05c3f" }] },
  }),
  lab({
    id: "circuits", title: "전구 두 개는 어떻게 연결해야 더 밝을까?", category: "회로와 저장", icon: "⏻",
    selectionTitle: "직렬·병렬 회로", selectionDescription: "어떻게 연결해야 전구가 더 밝을까?",
    question: "같은 전지와 전구 두 개를 직렬·병렬로 바꾸어 연결하면 각 전구의 밝기와 전체 전류는 어떻게 달라질까요?",
    steps: ["전구 두 개를 직렬과 병렬로 번갈아 연결해요.", "전구의 저항 손잡이를 좌우로 끌어요.", "각 전구 밝기와 전체 전류를 비교해요."],
    observe: "병렬에서는 각 전구가 전지 전압을 그대로 받아 밝아지고, 대신 전체 전류가 커지는지 보세요.",
    terms: [
      { name: "전압", description: "전하를 움직이게 하는 전기적인 차이예요." },
      { name: "전류", description: "전하가 한쪽 방향으로 흐르는 양이에요." },
      { name: "저항", description: "전류가 흐르기 어렵게 막는 정도예요." },
      { name: "직렬·병렬", description: "부품을 한 줄로 잇는 방식과 여러 갈래로 잇는 방식이에요." },
    ],
    controls: ["voltage", "resistance", "circuit-arrangement"],
    law: { title: "옴의 법칙과 전력", description: "전류는 전압에 비례하고 저항에 반비례하며 전력은 전압과 전류의 곱입니다.", equation: "V = IR · P = VI" },
    graph: { kind: "line", title: "전구 저항과 전체 전류", xLabel: "전구 하나의 저항 (Ω)", yLabel: "전체 전류 (A)", series: [{ label: "전체 전류", color: "#f2b84b" }] },
  }),
  lab({
    id: "capacitors", title: "축전기로 플래시를 얼마나 오래 켤까?", category: "회로와 저장", icon: "▮▯",
    selectionTitle: "축전기와 플래시", selectionDescription: "저장한 전기로 얼마나 오래 빛날까?",
    question: "축전기를 충전한 뒤 전지를 분리하고 플래시를 켜면 전압은 시간에 따라 어떻게 달라질까요?",
    steps: ["전지를 연결해 축전기를 충전해요.", "전지를 분리하고 판 간격을 바꾸어 보세요.", "플래시를 켜 전압과 밝기가 함께 줄어드는지 봐요."],
    observe: "저장된 전하가 플래시로 흐르면 빛이 밝게 켜졌다가 전압과 함께 어두워지는지 보세요.",
    terms: [
      { name: "축전기", description: "서로 마주 보는 판 사이에 전하와 에너지를 저장하는 장치예요." },
      { name: "전기용량", description: "축전기가 전하를 얼마나 많이 저장할 수 있는지를 나타내요." },
      { name: "충전", description: "축전기에 전하와 에너지를 채우는 과정이에요." },
      { name: "방전", description: "저장한 전하가 회로로 흘러나가는 과정이에요." },
    ],
    controls: ["plate-separation", "voltage", "capacitor-circuit"],
    law: { title: "축전기의 충전과 방전", description: "축전기는 전하를 저장하고, 부하에 연결하면 저장된 에너지를 전류로 내보내며 전압이 낮아집니다.", equation: "Q = CV · U = ½CV²" },
    graph: { kind: "line", title: "시간과 축전기 전압", xLabel: "시간 (s)", yLabel: "축전기 전압 (V)", series: [{ label: "축전기 전압", color: "#5b7cfa" }] },
  }),
  lab({
    id: "electromagnetic-force", title: "전류로 움직이는 도선을 어느 종에 닿게 할까?", category: "자기와 유도", icon: "☝",
    selectionTitle: "전류가 받는 힘", selectionDescription: "방향을 바꾸면 도선은 어디로 움직일까?",
    question: "전류와 자기장의 방향을 바꾸면 레일 위 도선이 위·아래 어느 쪽으로 실제 이동할까요?",
    steps: ["전류 화살표 끝을 좌우로 끌어 방향과 세기를 정해요.", "도선이 레일을 따라 움직이는 모습을 봐요.", "자기장을 뒤집어 반대쪽 종에도 닿게 해요."],
    observe: "전류나 자기장 중 하나만 뒤집으면 운동 방향도 반대가 되고, 전류가 세면 더 빠르게 움직이는지 보세요.",
    terms: [
      { name: "자기장", description: "자석이나 전류가 주변에 자기력을 만들 수 있는 공간이에요." },
      { name: "전자기력", description: "자기장 속에서 전류가 흐르는 도선이 받는 힘이에요." },
      { name: "플레밍의 왼손 법칙", description: "자기장·전류·힘의 서로 수직인 방향을 손가락으로 찾는 방법이에요." },
    ],
    controls: ["current-strength", "current-direction", "magnetic-direction"],
    law: { title: "플레밍의 왼손 법칙", description: "자기장 속 전류가 흐르는 도선은 전류와 자기장 모두에 수직인 힘을 받습니다.", equation: "F = BIL sinθ" },
    graph: { kind: "line", title: "전류 세기와 도선에 작용하는 힘", xLabel: "전류 (A)", yLabel: "힘 (상대값)", series: [{ label: "도선에 작용하는 힘", color: "#e05c3f" }] },
  }),
  lab({
    id: "induction", title: "자석을 얼마나 빨리 움직여야 전기가 생길까?", category: "자기와 유도", icon: "⌁",
    selectionTitle: "전자기 유도", selectionDescription: "자석을 움직이면 전기가 생길까?",
    question: "자석의 속도와 코일 감은 수를 바꾸면 유도 전압은 어떻게 달라질까요?",
    steps: ["자석을 코일 안팎으로 끌어 움직여요.", "같은 거리를 더 빠르게 움직여요.", "코일 감은 수와 전압 그래프를 비교해요."],
    observe: "자속이 빠르게 변할수록 더 큰 전압이 생기고 움직임이 멈추면 전압도 0이 되는지 보세요.",
    terms: [
      { name: "전자기 유도", description: "코일을 지나는 자기장이 변할 때 전압이 생기는 현상이에요." },
      { name: "자기선속", description: "어떤 면을 지나가는 자기장의 양을 나타내요." },
      { name: "유도 전압", description: "자기선속이 변해서 코일에 새로 생긴 전압이에요." },
    ],
    controls: ["magnet-position", "coil-turns"],
    law: { title: "패러데이 전자기 유도", description: "코일을 지나는 자기선속이 변할 때 그 변화를 방해하는 방향으로 전압이 생깁니다.", equation: "ε = −NΔΦ/Δt" },
    graph: { kind: "line", title: "자석 속도와 유도 전압", xLabel: "자석 속도 (m/s)", yLabel: "유도 전압 (V)", series: [{ label: "유도 전압", color: "#a069dc" }] },
  }),
  lab({
    id: "electromagnet", title: "전자석 크레인은 어떤 짐까지 들 수 있을까?", category: "전자기 장치", icon: "∿",
    selectionTitle: "전자석 크레인", selectionDescription: "전류를 세게 하면 더 무거운 짐을 들까?",
    question: "짐의 무게를 바꾸면서 전류와 코일 감은 수가 어느 정도여야 들어 올릴 수 있을까요?",
    steps: ["가벼운·보통·무거운 철제 짐 중 하나를 골라요.", "전자석을 짐까지 내려 붙는지 확인해요.", "들리지 않으면 전류나 코일 감은 수를 바꾼 뒤 다시 시도해요."],
    observe: "전자석의 힘이 짐에 필요한 힘보다 클 때만 붙어서 이동하는지 보세요.",
    terms: [
      { name: "전자석", description: "전류가 흐를 때만 자석의 성질을 띠는 장치예요." },
      { name: "코일", description: "도선을 여러 번 둥글게 감아 만든 장치예요." },
      { name: "솔레노이드", description: "도선을 원통 모양으로 촘촘히 감은 긴 코일이에요." },
    ],
    controls: ["current-handle", "coil-turns", "device-load"],
    law: { title: "솔레노이드의 자기장", description: "코일이 만드는 자기장은 전류와 단위 길이당 감은 수에 비례하며 전류를 뒤집으면 N극과 S극도 바뀝니다.", equation: "B ≈ μ₀(N/L)I" },
    graph: { kind: "line", title: "전류와 전자석의 들어 올리는 힘", xLabel: "전류 (A)", yLabel: "자기력 (상대값)", series: [{ label: "전자석의 힘", color: "#2b9bb5" }] },
  }),
  lab({
    id: "motor", title: "전동기는 얼마나 무거운 짐을 들 수 있을까?", category: "전자기 장치", icon: "↻",
    selectionTitle: "전동기", selectionDescription: "전기로 얼마나 무거운 짐을 들 수 있을까?",
    question: "전류와 자석 방향, 짐의 무게를 바꾸면 전동기가 짐을 들어 올리거나 멈추는 조건은 무엇일까요?",
    steps: ["전류를 약하게 두고 짐이 움직이는지 봐요.", "짐의 무게와 전류를 각각 바꾸어 비교해요.", "전류나 자석 방향을 뒤집어 짐이 내려가는지도 봐요."],
    observe: "전동기 토크가 짐에 필요한 토크보다 커야 짐이 올라가고, 방향을 뒤집으면 짐이 내려가는지 보세요.",
    terms: [
      { name: "전동기", description: "전기 에너지를 회전 운동으로 바꾸는 장치예요." },
      { name: "토크", description: "힘이 물체를 돌리려는 효과를 나타내는 양이에요." },
      { name: "회전 코일", description: "자기장 속에서 힘을 받아 돌아가는 전동기의 코일이에요." },
    ],
    controls: ["current-handle", "current-direction", "magnetic-direction", "device-load"],
    law: { title: "전동기의 힘과 토크", description: "자기장 속 코일의 양쪽 도선이 반대 방향의 힘을 받아 회전시키는 토크를 만듭니다.", equation: "τ = NBIA sinθ" },
    graph: { kind: "line", title: "전류와 전동기 토크", xLabel: "전류 (A)", yLabel: "토크 (상대값)", series: [{ label: "회전 토크", color: "#e05c3f" }] },
  }),
  lab({
    id: "generator", title: "손을 멈추면 마을의 불은 어떻게 될까?", category: "전자기 장치", icon: "⚡",
    selectionTitle: "발전기", selectionDescription: "더 빠르게 돌리면 불이 더 밝아질까?",
    question: "발전기 손잡이의 회전 속도와 코일 감은 수가 그 순간의 전구 밝기를 어떻게 바꿀까요?",
    steps: ["보라색 손잡이를 원을 따라 직접 돌려요.", "천천히 돌릴 때와 빠르게 돌릴 때 켜지는 집을 비교해요.", "손을 멈추고 전압과 불빛이 함께 사라지는지 봐요."],
    observe: "발전기는 전기를 저장하지 않으므로 회전이 느려지면 전압과 전구 밝기도 바로 줄어드는지 보세요.",
    terms: [
      { name: "발전기", description: "회전 운동을 전기 에너지로 바꾸는 장치예요." },
      { name: "유도 전압", description: "코일을 지나는 자기장이 변하면서 생기는 전압이에요." },
      { name: "전력", description: "전기 에너지가 한순간에 전달되거나 사용되는 빠르기예요." },
    ],
    controls: ["crank-angle", "crank-speed", "coil-turns"],
    law: { title: "회전 발전기와 패러데이 법칙", description: "코일을 지나는 자기선속을 더 빠르게 바꾸면 더 큰 유도 전압이 만들어집니다.", equation: "ε = NBAω sin(ωt)" },
    graph: { kind: "line", title: "발전기 회전 속도와 전압", xLabel: "회전 속도 (rpm)", yLabel: "유도 전압 (V)", series: [{ label: "발전 전압", color: "#f2b84b" }] },
  }),
  lab({
    id: "transformer", title: "변압기로 서로 다른 장치를 안전하게 켤 수 있을까?", category: "전자기 장치", icon: "⇄",
    selectionTitle: "변압기", selectionDescription: "코일 수로 전압을 바꿀 수 있을까?",
    question: "LED·라디오·로봇에 필요한 전압이 다를 때 2차 코일을 어떻게 바꾸어야 할까요?",
    steps: ["먼저 켤 장치를 선택해 필요한 전압을 확인해요.", "2차 코일 아래의 보라 손잡이를 좌우로 끌어요.", "입력 전압을 바꾼 뒤에도 권수비로 다시 맞추어 봐요."],
    observe: "같은 변압기도 장치가 요구하는 전압에 따라 필요한 2차 코일 수가 달라지는지 보세요.",
    terms: [
      { name: "변압기", description: "교류 전압을 더 높거나 낮게 바꾸는 장치예요." },
      { name: "1차·2차 코일", description: "전원을 연결하는 코일과 바뀐 전압을 꺼내 쓰는 코일이에요." },
      { name: "권수비", description: "1차 코일과 2차 코일을 감은 횟수의 비율이에요." },
      { name: "교류", description: "전류의 방향이 일정한 시간마다 바뀌는 전기예요." },
    ],
    controls: ["secondary-turns-handle", "primary-voltage", "appliance-target"],
    law: { title: "이상적인 변압기의 권수비", description: "교류 변압기의 전압비는 1차와 2차 코일의 감은 수 비와 같습니다.", equation: "V₂/V₁ = N₂/N₁" },
    graph: { kind: "line", title: "코일 권수비와 출력 전압", xLabel: "권수비 N₂/N₁", yLabel: "출력 전압 (V)", series: [{ label: "2차 전압", color: "#5b7cfa" }] },
  }),
];

export const ELECTROMAGNETISM_SUBJECT: SubjectDefinition = {
  id: "electromagnetism",
  label: "전자기학",
  eyebrow: "ELECTROMAGNETISM LAB",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
  sandboxDescription: "전하·회로·자석을 자유롭게 조합해요.",
  labs: ELECTROMAGNETISM_LABS,
};

validateSubjectDefinition(ELECTROMAGNETISM_SUBJECT, ELECTROMAGNETISM_LAB_IDS);

export function electromagnetismLab(id: string): SubjectLabDefinition {
  const found = ELECTROMAGNETISM_LABS.find((candidate) => candidate.id === id);
  if (!found) throw new RangeError(`Unknown electromagnetism lab: ${id}`);
  return found;
}
