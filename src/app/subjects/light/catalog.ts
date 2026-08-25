import { validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const LIGHT_LAB_IDS = [
  "propagation", "reflection", "refraction", "lenses", "prism", "diffraction", "polarization", "instruments",
] as const;
export type LightLabId = typeof LIGHT_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

export const lightDefinition: SubjectDefinition = {
  id: "light",
  label: "빛",
  eyebrow: "LIGHT LAB",
  sandboxTitle: "빈 빛 실험실 만들기",
  sandboxDescription: "광원과 광학 장치를 직접 놓고 광선이 어디로 가는지 확인해요.",
  labs: [
    lab({
      id: "propagation", title: "빛의 직진", category: "광선", icon: "➜",
      question: "광원의 높이를 바꾸면 작은 구멍을 지난 빛은 화면 어디에 닿을까요?",
      steps: ["노란 광원을 잡아 위아래로 옮겨요.", "빛이 구멍을 지나는 위치를 맞춰요.", "거리별 광선 높이 그래프를 비교해요."],
      observe: "광원, 구멍, 스크린의 밝은 점이 한 직선 위에 놓이는지 보세요.",
      controls: ["광원 높이"],
      law: { title: "빛의 직진", description: "같은 물질 속에서 빛은 곧은 경로로 나아갑니다.", equation: "y = y₀ + x tanθ" },
      graph: { kind: "line", title: "진행 거리에 따른 광선 높이", xLabel: "진행 거리 (cm)", yLabel: "높이 (cm)", series: [{ label: "광선", color: "#ffd34d" }] },
    }),
    lab({
      id: "reflection", title: "반사", category: "광선", icon: "↗",
      question: "거울을 돌리면 반사된 빛의 각도는 입사각과 어떤 관계를 가질까요?",
      steps: ["파란 거울 손잡이를 잡아 돌려요.", "여러 거울 각도에서 반사광을 살펴봐요.", "입사각과 반사각 그래프를 비교해요."],
      observe: "법선을 기준으로 들어오는 각과 나가는 각이 같은지 보세요.",
      controls: ["거울 각도"],
      law: { title: "반사 법칙", description: "법선에서 잰 입사각과 반사각은 언제나 같습니다.", equation: "θᵢ = θᵣ" },
      graph: { kind: "line", title: "입사각과 반사각", xLabel: "입사각 (°)", yLabel: "반사각 (°)", series: [{ label: "반사광", color: "#70d6ff" }] },
    }),
    lab({
      id: "refraction", title: "굴절", category: "경계", icon: "⌁",
      question: "광원을 옆으로 움직여 입사각을 바꾸면 물속의 빛은 얼마나 꺾일까요?",
      steps: ["광원을 좌우로 옮겨 입사각을 바꿔요.", "공기와 물 경계에서 꺾인 광선을 봐요.", "입사각과 굴절각 그래프를 비교해요."],
      observe: "굴절률이 큰 물로 들어갈 때 광선이 법선 쪽으로 가까워지는지 보세요.",
      controls: ["입사각", "매질"],
      law: { title: "스넬 법칙", description: "경계를 지날 때 굴절률과 각도의 사인값이 균형을 이룹니다.", equation: "n₁ sinθ₁ = n₂ sinθ₂" },
      graph: { kind: "line", title: "입사각에 따른 굴절각", xLabel: "입사각 (°)", yLabel: "굴절각 (°)", series: [{ label: "물속 광선", color: "#4cc9f0" }] },
    }),
    lab({
      id: "lenses", title: "렌즈", category: "상", icon: "◉",
      question: "물체를 볼록렌즈에 가까이 가져가면 상의 위치와 크기는 어떻게 달라질까요?",
      steps: ["초록 물체 화살표를 좌우로 옮겨요.", "렌즈 반대편에서 맺히는 상을 찾아요.", "물체 거리와 상의 크기 그래프를 비교해요."],
      observe: "초점을 지나는 실제 광선의 교점과 뒤집힌 상의 크기를 함께 보세요.",
      controls: ["물체 거리"],
      law: { title: "얇은 렌즈식", description: "초점거리, 물체거리, 상거리가 하나의 관계로 연결됩니다.", equation: "1/f = 1/dₒ + 1/dᵢ" },
      graph: { kind: "line", title: "물체 거리에 따른 배율", xLabel: "물체 거리 (cm)", yLabel: "배율 (배)", series: [{ label: "상의 배율", color: "#80ed99" }] },
    }),
    lab({
      id: "prism", title: "프리즘과 색", category: "색", icon: "△",
      question: "프리즘을 돌리면 빨강과 보라 빛이 갈라져 나가는 방향은 어떻게 달라질까요?",
      steps: ["프리즘 꼭짓점 손잡이를 잡아 돌려요.", "나오는 색 광선의 벌어짐을 살펴봐요.", "파장별 굴절각 스펙트럼을 비교해요."],
      observe: "굴절률이 큰 보라빛이 빨간빛보다 더 많이 꺾이는지 보세요.",
      controls: ["프리즘 방향"],
      law: { title: "분산", description: "물질의 굴절률은 파장에 따라 달라져 흰빛이 여러 색으로 갈라집니다.", equation: "δ(λ) ≈ [n(λ)-1]A" },
      graph: { kind: "spectrum", title: "파장에 따른 프리즘 편향", xLabel: "파장 (nm)", yLabel: "편향각 (°)", series: [{ label: "색 분산", color: "#b77bff" }] },
    }),
    lab({
      id: "diffraction", title: "간섭과 회절", category: "파동", icon: "|||",
      question: "두 슬릿 사이를 바꾸면 스크린의 밝고 어두운 줄 간격은 어떻게 달라질까요?",
      steps: ["분홍 슬릿 손잡이를 위아래로 벌려요.", "스크린의 밝은 무늬 간격을 살펴봐요.", "화면 위치별 빛의 세기 그래프를 비교해요."],
      observe: "슬릿 사이가 좁아질수록 밝은 줄 사이가 넓어지는지 보세요.",
      controls: ["슬릿 간격"],
      law: { title: "이중 슬릿 간섭", description: "두 슬릿의 경로 차이가 파장의 정수배인 방향에서 밝아집니다.", equation: "d sinθ = mλ" },
      graph: { kind: "pattern", title: "스크린의 간섭·회절 무늬", xLabel: "화면 위치 (mm)", yLabel: "상대 세기", series: [{ label: "빛의 세기", color: "#ff70a6" }] },
    }),
    lab({
      id: "polarization", title: "편광", category: "세기", icon: "⊘",
      question: "두 번째 편광판을 돌리면 통과하는 빛의 밝기는 어떤 규칙으로 변할까요?",
      steps: ["주황 편광판 손잡이를 잡아 돌려요.", "각도에 따라 스크린 밝기를 살펴봐요.", "편광판 각도와 세기 그래프를 비교해요."],
      observe: "두 편광축이 직각일 때 빛이 거의 사라지는지 보세요.",
      controls: ["편광판 각도"],
      law: { title: "말뤼스 법칙", description: "두 편광축 사이 각도의 코사인 제곱만큼 빛이 통과합니다.", equation: "I = I₀ cos²θ" },
      graph: { kind: "line", title: "편광축 각도에 따른 밝기", xLabel: "축 사이 각도 (°)", yLabel: "상대 세기 (%)", series: [{ label: "통과한 빛", color: "#ff9f1c" }] },
    }),
    lab({
      id: "instruments", title: "광학 기기", category: "상", icon: "◌",
      question: "망원경의 접안렌즈를 바꾸면 멀리 있는 물체는 몇 배 크게 보일까요?",
      steps: ["작은 접안렌즈 손잡이를 위아래로 움직여요.", "렌즈를 지난 평행 광선의 기울기를 봐요.", "접안렌즈 초점거리와 배율을 비교해요."],
      observe: "접안렌즈 초점거리가 짧을수록 각배율이 커지는지 보세요.",
      controls: ["접안렌즈 초점거리"],
      law: { title: "망원경의 각배율", description: "대물렌즈 초점거리를 접안렌즈 초점거리로 나눈 값이 각배율입니다.", equation: "M = -fₒ/fₑ" },
      graph: { kind: "line", title: "접안렌즈에 따른 망원경 배율", xLabel: "접안 초점거리 (cm)", yLabel: "각배율 (배)", series: [{ label: "확대 배율", color: "#a8dadc" }] },
    }),
  ],
};

validateSubjectDefinition(lightDefinition, LIGHT_LAB_IDS);

export const lightLab = (id: LightLabId): SubjectLabDefinition =>
  lightDefinition.labs.find((candidate) => candidate.id === id)!;
