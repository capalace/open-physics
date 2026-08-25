import type { PlaygroundPreset } from "./physics-playground";

export type LabControl = "mass" | "material" | "gravity" | "velocity";
export type LabActivationSource = "initial" | "selection";

export function shouldAutoPlayLab(source: LabActivationSource): boolean {
  return source === "selection";
}

export interface MechanicsLab {
  readonly id: PlaygroundPreset;
  readonly title: string;
  readonly category: "움직임과 힘" | "회전과 연결" | "중력과 유체";
  readonly icon: string;
  readonly question: string;
  readonly steps: readonly [string, string, string];
  readonly observe: string;
  readonly controls: readonly LabControl[];
  readonly law: {
    readonly title: string;
    readonly description: string;
    readonly equation: string;
  };
}

export const MECHANICS_LABS: readonly MechanicsLab[] = [
  {
    id: "free-fall",
    title: "질량이 달라도 같이 떨어질까?",
    category: "움직임과 힘",
    icon: "↓",
    question: "가벼운 공과 무거운 공은 바닥에 닿는 시간이 다를까요?",
    steps: ["세 공의 높이를 맞춰요.", "중력을 달이나 목성으로 바꿔요.", "공들이 바닥에 닿는 순간을 비교해요."],
    observe: "질량보다 중력 환경이 떨어지는 속도 변화에 어떤 영향을 주는지 보세요.",
    controls: ["mass", "gravity"],
    law: { title: "중력과 가속도", description: "중력은 물체를 아래로 끌어 속도를 계속 바꿉니다.", equation: "F = mg" },
  },
  {
    id: "projectile",
    title: "어떤 각도로 던져야 멀리 갈까?",
    category: "움직임과 힘",
    icon: "↗",
    question: "같은 빠르기라면 어느 방향으로 던질 때 가장 멀리 갈까요?",
    steps: ["보라색 화살표를 끌어 방향을 정해요.", "공을 놓아 날아가는 길을 봐요.", "처음으로 돌아가 다른 각도와 비교해요."],
    observe: "옆 방향 속도와 아래 방향 가속도가 함께 만드는 곡선을 보세요.",
    controls: ["gravity", "velocity"],
    law: { title: "던진 물체의 운동", description: "옆으로 가는 동안 중력이 아래쪽 속도를 더해 곡선으로 움직입니다.", equation: "x = x₀ + v₀t + ½at²" },
  },
  {
    id: "collision",
    title: "충돌하면 움직임은 어디로 갈까?",
    category: "움직임과 힘",
    icon: "⇄",
    question: "두 공의 무게가 달라지면 충돌 뒤 움직임은 어떻게 달라질까요?",
    steps: ["두 공의 무게를 서로 다르게 정해요.", "속도 화살표로 충돌 방향을 바꿔요.", "충돌 전후 운동량 화살표를 비교해요."],
    observe: "충돌 순간 전달되는 충격량과 두 물체의 전체 운동량을 관찰하세요.",
    controls: ["mass", "material", "velocity"],
    law: { title: "충돌·운동량·충격량", description: "부딪히는 순간 운동량이 전달되고, 짧게 작용한 힘이 움직임을 바꿉니다.", equation: "p = mv · J = Δp" },
  },
  {
    id: "spring",
    title: "용수철은 에너지를 어떻게 돌려줄까?",
    category: "움직임과 힘",
    icon: "⌁",
    question: "공을 더 멀리 당기면 돌아올 때 얼마나 빨라질까요?",
    steps: ["공을 잡아 제자리에서 멀리 당겨요.", "손을 놓고 에너지 막대를 봐요.", "공의 무게를 바꾸어 왕복 운동을 비교해요."],
    observe: "용수철 에너지가 줄 때 움직임 에너지가 커지는지 보세요.",
    controls: ["mass"],
    law: { title: "용수철과 에너지", description: "용수철의 복원력이 저장된 에너지와 움직임 에너지를 서로 바꿉니다.", equation: "F = −kx · E = ½mv² + ½kx²" },
  },
  {
    id: "friction",
    title: "얼마나 세게 밀어야 움직일까?",
    category: "움직임과 힘",
    icon: "▰",
    question: "상자가 버티다가 움직이기 시작하는 순간의 힘은 얼마일까요?",
    steps: ["빨간 손잡이를 천천히 옆으로 당겨요.", "상자가 처음 움직이는 힘을 그래프에서 찾아요.", "재질과 무게를 바꾸어 필요한 힘을 비교해요."],
    observe: "내가 주는 힘과 최대 정지 마찰력이 같아지는 순간을 눈여겨보세요.",
    controls: ["material", "mass"],
    law: { title: "정지 마찰력", description: "정지 마찰력은 물체를 붙잡아 두다가 한계를 넘으면 미끄러지기 시작합니다.", equation: "Fₛ ≤ μₛN" },
  },
  {
    id: "rotation",
    title: "지렛대로 무거운 짐을 들 수 있을까?",
    category: "회전과 연결",
    icon: "⚖",
    question: "같은 짐도 받침점에서 멀리 누르면 더 쉽게 들 수 있을까요?",
    steps: ["막대 위 세 힘점 중 하나를 골라요.", "빨간 손잡이를 아래로 천천히 눌러요.", "힘점을 바꾸어 필요한 힘을 그래프로 비교해요."],
    observe: "받침점에서 힘점까지의 거리가 길어질수록 필요한 힘이 줄어드는지 보세요.",
    controls: ["mass"],
    law: { title: "지렛대와 토크", description: "받침점에서 더 먼 곳을 누르면 같은 힘으로 더 큰 돌림 효과를 냅니다.", equation: "F₁r₁ = F₂r₂" },
  },
  {
    id: "constraints",
    title: "줄과 막대는 움직임을 어떻게 제한할까?",
    category: "회전과 연결",
    icon: "╱",
    question: "같은 길이의 줄과 막대에 매단 추는 어떤 길로 움직일까요?",
    steps: ["줄 추와 막대 추를 서로 다른 각도로 끌어요.", "손을 놓아 두 진자를 움직여요.", "고정점에서 추까지의 거리를 비교해요."],
    observe: "추가 움직여도 연결 길이가 일정하게 유지되는지 보세요.",
    controls: ["gravity"],
    law: { title: "진자와 줄·막대", description: "길이가 고정된 연결 안에서 중력이 추를 왕복 운동하게 합니다.", equation: "|A − B| = L · T ≈ 2π√(L/g)" },
  },
  {
    id: "pulley",
    title: "도르래 줄이 많으면 얼마나 쉬워질까?",
    category: "회전과 연결",
    icon: "◉",
    question: "무거운 짐을 받치는 줄을 늘리면 필요한 힘은 얼마나 줄어들까요?",
    steps: ["위쪽에서 1줄, 2줄, 4줄을 차례로 골라요.", "빨간 손잡이를 같은 거리만큼 아래로 당겨 봐요.", "손잡이가 따라오는 정도와 실제로 당긴 줄의 거리를 함께 비교해요."],
    observe: "필요한 힘이 적을수록 손잡이가 더 잘 따라오고, 같은 높이에는 더 긴 줄이 필요한지 보세요.",
    controls: ["mass"],
    law: { title: "도르래의 역학적 이득", description: "짐을 받치는 줄이 많을수록 필요한 힘은 줄지만 당겨야 하는 거리는 늘어납니다.", equation: "F = mg/n · d당김 = nd상승" },
  },
  {
    id: "orbit",
    title: "조금만 다르게 쏘면 궤도를 벗어날까?",
    category: "중력과 유체",
    icon: "◎",
    question: "발사 속도나 방향을 조금 바꾸면 충돌·공전·이탈 중 무엇이 될까요?",
    steps: ["작은 별의 보라색 속도 손잡이를 끌어요.", "색 점선으로 예상되는 길과 판정을 먼저 봐요.", "길이와 방향을 조금씩 바꾸어 세 결과를 찾아요."],
    observe: "비슷해 보이는 발사도 방향과 탈출 속력에 따라 완전히 다른 길이 되는지 보세요.",
    controls: ["velocity"],
    law: { title: "만유인력과 탈출 속력", description: "중력이 진행 방향을 계속 휘게 하지만 충분히 빠르면 행성의 중력을 벗어납니다.", equation: "v원 = √(GM/r) · v탈출 = √(2GM/r)" },
  },
  {
    id: "buoyancy",
    title: "물체는 언제 물에 뜰까?",
    category: "중력과 유체",
    icon: "≈",
    question: "공의 무게를 바꾸면 물에 잠기는 정도가 어떻게 달라질까요?",
    steps: ["공을 물속으로 끌어 넣어요.", "손을 놓고 위로 미는 힘을 봐요.", "무게를 바꾸어 잠기는 깊이를 비교해요."],
    observe: "물에 잠긴 부피가 커질수록 부력이 커지는 모습을 보세요.",
    controls: ["mass"],
    law: { title: "부력", description: "물에 잠긴 부피가 커질수록 위로 미는 힘이 커집니다.", equation: "Fᵦ = ρgV" },
  },
];

export function mechanicsLab(id: PlaygroundPreset): MechanicsLab {
  const lab = MECHANICS_LABS.find((candidate) => candidate.id === id);
  if (!lab) throw new RangeError(`Unknown mechanics lab: ${id}`);
  return lab;
}
