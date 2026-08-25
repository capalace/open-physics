import type { PlaygroundPreset } from "./physics-playground";

export type LabControl = "mass" | "material" | "gravity" | "velocity";

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
    title: "어떤 재질이 가장 멀리 미끄러질까?",
    category: "움직임과 힘",
    icon: "▰",
    question: "고무, 나무, 금속, 점토 중 어떤 공이 가장 늦게 멈출까요?",
    steps: ["재질 하나를 골라 출발시켜요.", "멈춘 위치를 격자로 확인해요.", "처음으로 돌아가 다른 재질과 비교해요."],
    observe: "마찰력이 운동 반대 방향으로 작용해 속도를 줄이는 모습을 보세요.",
    controls: ["material", "mass"],
    law: { title: "마찰력", description: "마찰력은 움직이는 반대 방향으로 작용해 물체를 천천히 멈춥니다.", equation: "F = μN" },
  },
  {
    id: "rotation",
    title: "회전축에서 멀수록 더 잘 돌까?",
    category: "회전과 연결",
    icon: "⚖",
    question: "양쪽 추의 무게 차이가 막대의 회전을 어떻게 바꿀까요?",
    steps: ["양쪽 추를 번갈아 선택해 무게를 정해요.", "추를 끌어 막대의 시작 각도를 바꿔요.", "손을 놓고 어느 쪽으로 도는지 봐요."],
    observe: "회전축을 기준으로 힘이 만드는 토크의 방향을 관찰하세요.",
    controls: ["mass"],
    law: { title: "회전과 토크", description: "회전축에서 떨어진 곳에 작용하는 힘이 막대를 돌립니다.", equation: "τ = Iα" },
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
    title: "도르래의 어느 쪽이 내려갈까?",
    category: "회전과 연결",
    icon: "◉",
    question: "줄 양쪽 추의 무게 차이가 움직임을 어떻게 결정할까요?",
    steps: ["양쪽 추를 번갈아 선택해 무게를 정해요.", "추 하나를 위아래로 끌어 시작 위치를 바꿔요.", "손을 놓고 두 추가 움직인 거리를 비교해요."],
    observe: "한쪽이 내려간 거리와 다른 쪽이 올라간 거리가 같은지 보세요.",
    controls: ["mass"],
    law: { title: "도르래", description: "줄로 연결된 두 추는 같은 거리만큼 반대 방향으로 움직입니다.", equation: "a = g(m₂−m₁)/(m₁+m₂)" },
  },
  {
    id: "orbit",
    title: "별은 왜 바깥으로 날아가지 않을까?",
    category: "중력과 유체",
    icon: "◎",
    question: "옆으로 움직이는 작은 별을 중력이 계속 당기면 어떤 길이 생길까요?",
    steps: ["작은 별의 속도 화살표를 바꿔요.", "실행해 큰 별 주위를 도는 길을 봐요.", "더 빠르거나 느린 속도와 비교해요."],
    observe: "속도는 진행 방향을, 가속도는 궤도 중심을 가리키는지 보세요.",
    controls: ["velocity"],
    law: { title: "원운동·만유인력·궤도", description: "중력이 중심 가속도가 되어 작은 별의 속도 방향을 계속 바꿉니다.", equation: "a = v²/r · F = GMm/r²" },
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
