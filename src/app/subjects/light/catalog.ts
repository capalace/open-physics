import { SUBJECT_SANDBOX_TITLE, validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const LIGHT_LAB_IDS = [
  "propagation", "reflection", "refraction", "total-internal-reflection", "lenses", "prism", "diffraction", "polarization", "instruments", "laser",
] as const;
export type LightLabId = typeof LIGHT_LAB_IDS[number];

const lab = (definition: SubjectLabDefinition): SubjectLabDefinition => definition;

const termsByLab: Record<LightLabId, NonNullable<SubjectLabDefinition["terms"]>> = {
  propagation: [
    { name: "광선", description: "빛이 나아가는 경로와 방향을 선으로 나타낸 것이에요." },
    { name: "빛의 직진", description: "한 가지 균일한 물질 안에서 빛이 곧게 나아가는 성질이에요." },
    { name: "그림자", description: "직진하는 빛이 물체에 가려 도달하지 못한 영역이에요." },
  ],
  reflection: [
    { name: "입사각", description: "들어오는 광선과 경계면의 법선 사이 각도예요." },
    { name: "반사각", description: "반사되어 나가는 광선과 법선 사이 각도예요." },
    { name: "법선", description: "빛이 닿은 점에서 경계면에 수직으로 그은 기준선이에요." },
  ],
  refraction: [
    { name: "굴절", description: "빛이 서로 다른 물질의 경계를 지날 때 진행 방향이 꺾이는 현상이에요." },
    { name: "굴절률", description: "진공에서의 빛 속력을 물질 속 빛 속력으로 나눈 값이에요." },
    { name: "스넬 법칙", description: "경계 양쪽의 굴절률과 입사각·굴절각의 관계를 나타내는 법칙이에요." },
  ],
  "total-internal-reflection": [
    { name: "전반사", description: "굴절률이 큰 물질에서 작은 물질로 갈 때 빛이 모두 반사되는 현상이에요." },
    { name: "임계각", description: "굴절각이 90도가 되어 전반사가 시작되는 가장 작은 입사각이에요." },
    { name: "광섬유", description: "전반사를 반복해 빛으로 정보를 멀리 보내는 가느다란 유리 섬유예요." },
  ],
  lenses: [
    { name: "초점", description: "축과 나란히 들어온 빛이 렌즈를 지난 뒤 모이거나 퍼져 나오는 기준점이에요." },
    { name: "실상", description: "실제 광선이 모여 스크린에 비출 수 있는 상이에요." },
    { name: "배율", description: "상의 크기를 물체의 크기로 나눈 값이에요." },
  ],
  prism: [
    { name: "분산", description: "굴절률의 파장 의존성 때문에 여러 색의 빛이 서로 다른 각도로 갈라지는 현상이에요." },
    { name: "파장", description: "빛의 한 진동 상태가 공간에서 반복되는 간격이에요." },
    { name: "스펙트럼", description: "빛을 파장이나 진동수에 따라 나누어 펼쳐 놓은 것이에요." },
  ],
  diffraction: [
    { name: "회절", description: "파동이 좁은 틈이나 물체 가장자리를 지나며 퍼지는 현상이에요." },
    { name: "경로차", description: "두 빛이 같은 지점까지 이동한 거리의 차이예요." },
    { name: "간섭무늬", description: "보강과 상쇄 간섭이 반복되어 밝고 어두운 띠로 나타난 무늬예요." },
  ],
  polarization: [
    { name: "편광", description: "빛의 전기장이 특정한 방향으로만 진동하도록 고른 상태예요." },
    { name: "편광축", description: "편광판이 통과시키는 전기장 진동의 방향이에요." },
    { name: "말뤼스 법칙", description: "두 편광축 사이 각도에 따라 통과 세기가 코사인 제곱으로 변한다는 법칙이에요." },
  ],
  instruments: [
    { name: "대물렌즈", description: "멀리 있는 물체의 빛을 모아 첫 번째 상을 만드는 렌즈예요." },
    { name: "접안렌즈", description: "대물렌즈가 만든 상을 눈으로 확대해 보는 렌즈예요." },
    { name: "각배율", description: "광학 기기를 쓸 때 물체가 맨눈보다 몇 배 큰 각도로 보이는지를 나타내요." },
  ],
  laser: [
    { name: "유도 방출", description: "들뜬 원자가 들어온 광자와 같은 성질의 광자를 하나 더 내보내는 현상이에요." },
    { name: "결맞음", description: "여러 빛의 진동수와 위상 관계가 가지런히 맞아 있는 성질이에요." },
    { name: "공진기", description: "두 거울 사이에서 빛을 왕복시켜 특정 빛을 증폭하는 장치예요." },
  ],
};

export const lightDefinition: SubjectDefinition = {
  id: "light",
  label: "빛",
  eyebrow: "빛",
  sandboxTitle: SUBJECT_SANDBOX_TITLE,
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
      id: "total-internal-reflection", title: "전반사와 광통신", category: "경계", icon: "↪",
      question: "유리 안에서 경계로 향하는 빛의 각도를 키우면 언제부터 빛이 밖으로 나오지 못할까요?",
      steps: ["유리 안의 노란 광원을 잡아요.", "좌우로 옮겨 입사각을 키워요.", "임계각 전후의 투과광과 반사광을 비교해요."],
      observe: "임계각보다 큰 입사각에서 굴절광이 사라지고 빛이 모두 유리 안으로 반사되는지 보세요.",
      terms: termsByLab["total-internal-reflection"],
      controls: ["유리 안 입사각"],
      law: { title: "전반사 임계각", description: "굴절률이 큰 곳에서 작은 곳으로 갈 때 입사각이 임계각보다 크면 전반사가 일어나요.", equation: "sinθc = n₂/n₁" },
      graph: { kind: "line", title: "입사각에 따른 빛의 투과", xLabel: "입사각 (°)", yLabel: "투과율 (%)", series: [{ label: "경계를 통과한 빛", color: "#22d3ee" }] },
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
    lab({
      id: "laser", title: "레이저", category: "빛과 정보", icon: "━",
      question: "원자에 공급하는 에너지를 높이면 언제부터 한 색의 강한 레이저 빛이 만들어질까요?",
      steps: ["아래 주황색 에너지 손잡이를 잡아요.", "문턱보다 낮고 높게 번갈아 옮겨요.", "공진기 안 광자와 출력 세기를 비교해요."],
      observe: "문턱을 넘으면 같은 방향·진동수·위상의 광자가 연쇄적으로 늘어나는지 보세요.",
      terms: termsByLab.laser,
      controls: ["공급 에너지 · 원자를 들뜨게 만드는 세기 (%)"],
      law: { title: "레이저 발진 문턱", description: "유도 방출로 늘어나는 빛이 손실보다 많아지는 문턱을 넘어야 강한 레이저가 나와요.", equation: "이득 > 손실" },
      graph: { kind: "line", title: "공급 에너지와 레이저 출력", xLabel: "공급 에너지 (%)", yLabel: "출력 세기 (%)", series: [{ label: "레이저 출력", color: "#ff4d6d" }] },
    }),
  ].map((definition) => ({ ...definition, terms: termsByLab[definition.id as LightLabId] })),
};

validateSubjectDefinition(lightDefinition, LIGHT_LAB_IDS);

export const lightLab = (id: LightLabId): SubjectLabDefinition =>
  lightDefinition.labs.find((candidate) => candidate.id === id)!;
