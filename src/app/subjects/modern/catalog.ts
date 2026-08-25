import { validateSubjectDefinition, type SubjectDefinition, type SubjectLabDefinition } from "../subject-experience";

export const MODERN_LAB_IDS = ["relativity", "atoms", "photoelectric", "matter-waves", "quantum", "tunneling", "nuclei", "semiconductors"] as const;
export type ModernLabId = (typeof MODERN_LAB_IDS)[number];

const labs: readonly SubjectLabDefinition[] = [
  {
    id: "relativity", title: "상대성이론", category: "시공간", icon: "⌚",
    question: "우주선 속도가 빛의 속도에 가까워질수록 두 시계의 시간은 얼마나 달라질까요?",
    steps: ["청록색 속도 손잡이를 잡아요.", "빛의 속도에 가깝게 옮겨요.", "두 시계와 시간 그래프를 비교해요."],
    observe: "지구 시계와 움직이는 우주선 시계가 가리키는 시간이 달라지는지 보세요.",
    controls: ["속도 · 빛의 속력을 1로 본 비율 (c)"],
    law: { title: "시간 지연", description: "빠르게 움직이는 시계의 고유 시간은 지구에서 잰 시간보다 적게 흘러요.", equation: "γ = 1/√(1-v²/c²)" },
    graph: { kind: "line", title: "속도에 따른 시간 지연", xLabel: "속도 (c)", yLabel: "로런츠 인자 γ", series: [{ label: "시간 지연", color: "#2dd4bf" }] },
  },
  {
    id: "atoms", title: "원자", category: "에너지 준위", icon: "≡",
    question: "전자가 다른 에너지 준위로 전이할 때 방출 광자의 에너지는 어떻게 달라질까요?",
    steps: ["보라색 준위 손잡이를 잡아요.", "다른 에너지 선으로 옮겨요.", "전이 화살표와 스펙트럼을 비교해요."],
    observe: "전자는 선 사이를 도는 대신 허용된 에너지 준위에서만 검출된다고 보세요.",
    controls: ["주양자수 · 수소 원자의 허용 에너지 준위 n"],
    law: { title: "수소 에너지 준위", description: "수소 원자의 에너지는 연속이 아니라 n으로 정해진 값만 가질 수 있어요.", equation: "Eₙ = -13.6 eV/n²" },
    graph: { kind: "spectrum", title: "준위 전이 에너지", xLabel: "주양자수 n", yLabel: "에너지 (eV)", series: [{ label: "허용 준위", color: "#a78bfa" }] },
  },
  {
    id: "photoelectric", title: "광전 효과", category: "광자", icon: "✦",
    question: "빛의 주파수를 문턱보다 높이면 튀어나온 전자의 최대 운동에너지는 어떻게 변할까요?",
    steps: ["노란 광자원 손잡이를 잡아요.", "좌우로 옮겨 주파수를 바꿔요.", "전자 검출과 에너지 그래프를 봐요."],
    observe: "문턱 아래에서는 전자가 나오지 않고 그 위에서만 검출 사건이 생기는지 보세요.",
    controls: ["빛 주파수 · 1초 동안 진동하는 횟수 (PHz)"],
    law: { title: "광전 방정식", description: "광자 에너지가 금속의 일함수를 넘어선 나머지가 전자의 최대 운동에너지가 돼요.", equation: "Kₘₐₓ = hf - φ" },
    graph: { kind: "line", title: "광자 주파수와 전자 에너지", xLabel: "주파수 (PHz)", yLabel: "최대 운동에너지 (eV)", series: [{ label: "광전자", color: "#facc15" }] },
  },
  {
    id: "matter-waves", title: "물질파", category: "파동-입자", icon: "≈",
    question: "입자의 운동량을 크게 하면 검출 확률 무늬의 파장은 어떻게 변할까요?",
    steps: ["파란 운동량 손잡이를 잡아요.", "좌우로 옮겨 운동량을 바꿔요.", "확률 파장과 검출점을 비교해요."],
    observe: "입자는 한 궤적이 아니라 반복 검출로 드러나는 확률 무늬를 만든다고 보세요.",
    controls: ["운동량 · 입자의 운동 상태를 나타내는 양 (10⁻²⁴ kg·m/s)"],
    law: { title: "드브로이 파장", description: "입자의 운동량이 커질수록 물질파의 파장은 짧아져요.", equation: "λ = h/p" },
    graph: { kind: "waveform", title: "물질파 확률 무늬", xLabel: "검출 위치 (nm)", yLabel: "검출 확률", series: [{ label: "확률밀도", color: "#60a5fa" }] },
  },
  {
    id: "quantum", title: "양자 물리", category: "확률", icon: "Ψ",
    question: "파동묶음을 더 좁게 준비하면 위치 검출 확률은 어떻게 모일까요?",
    steps: ["분홍색 폭 손잡이를 잡아요.", "좌우로 옮겨 퍼짐을 바꿔요.", "확률분포와 검출점을 비교해요."],
    observe: "한 번의 확정 궤적이 아니라 여러 번 검출된 위치의 분포를 관찰하세요.",
    controls: ["파동묶음 폭 · 위치 확률이 퍼진 정도 σ (nm)"],
    law: { title: "확률밀도", description: "파동함수의 절댓값 제곱은 각 위치에서 검출될 확률밀도를 나타내요.", equation: "P(x) = |ψ(x)|²" },
    graph: { kind: "distribution", title: "위치 검출 확률분포", xLabel: "위치 (nm)", yLabel: "확률밀도 (1/nm)", series: [{ label: "검출 확률", color: "#f472b6" }] },
  },
  {
    id: "tunneling", title: "양자 터널링", category: "장벽", icon: "▥",
    question: "같은 입자 에너지에서 장벽을 넓히면 반대편 검출 확률은 얼마나 줄어들까요?",
    steps: ["주황색 장벽 끝을 잡아요.", "좌우로 끌어 폭을 바꿔요.", "장벽 뒤 검출과 확률을 비교해요."],
    observe: "에너지가 장벽보다 낮아도 장벽 뒤에서 작은 검출 확률이 남는지 보세요.",
    controls: ["장벽 폭 · 통과해야 하는 영역의 두께 (nm)"],
    law: { title: "터널링 확률", description: "장벽 안에서 파동함수가 지수적으로 줄어 장벽이 넓을수록 통과 확률이 작아져요.", equation: "T ≈ e⁻²κa" },
    graph: { kind: "line", title: "장벽 폭과 투과 확률", xLabel: "장벽 폭 (nm)", yLabel: "투과 확률", series: [{ label: "투과", color: "#fb923c" }] },
  },
  {
    id: "nuclei", title: "원자핵", category: "붕괴 통계", icon: "✺",
    question: "반감기가 지날 때마다 아직 붕괴하지 않은 핵의 수는 어떤 비율로 줄어들까요?",
    steps: ["초록색 시간 손잡이를 잡아요.", "오른쪽으로 옮겨 시간을 흘려요.", "핵 표본과 붕괴 곡선을 비교해요."],
    observe: "개별 핵의 정확한 붕괴 순간 대신 많은 핵의 남은 개수 통계를 보세요.",
    controls: ["경과 시간 · 핵 표본을 관찰한 시간 (년)"],
    law: { title: "방사성 붕괴", description: "반감기마다 많은 핵 표본의 절반이 통계적으로 남아요.", equation: "N = N₀·2⁻ᵗ⁄ᵀ½" },
    graph: { kind: "line", title: "시간에 따른 남은 원자핵", xLabel: "시간 (년)", yLabel: "남은 핵 (개)", series: [{ label: "미붕괴 핵", color: "#4ade80" }] },
  },
  {
    id: "semiconductors", title: "반도체", category: "에너지 띠", icon: "▰",
    question: "다이오드에 순방향 전압을 높이면 흐르는 전류는 어떤 모양으로 증가할까요?",
    steps: ["빨간 전압 손잡이를 잡아요.", "좌우로 옮겨 전압을 바꿔요.", "전하 흐름과 전류 곡선을 비교해요."],
    observe: "p-n 접합의 장벽이 낮아지면서 검출되는 전하 흐름이 급격히 늘어나는지 보세요.",
    controls: ["전압 · p-n 접합 양끝의 전위차 (V)"],
    law: { title: "다이오드 전류", description: "순방향 전압이 커지면 접합을 지나는 전류가 지수적으로 증가해요.", equation: "I = Iₛ(eⱽ⁄ⱽᵀ-1)" },
    graph: { kind: "line", title: "다이오드 전압-전류", xLabel: "전압 (V)", yLabel: "전류 (mA)", series: [{ label: "순방향 전류", color: "#fb7185" }] },
  },
];

export const modernDefinition: SubjectDefinition = {
  id: "modern", label: "현대물리", eyebrow: "MODERN PHYSICS LAB",
  sandboxTitle: "빈 현대물리 실험실 만들기",
  sandboxDescription: "광자원, 금속, 원자, 장벽, 검출기와 핵 표본을 직접 놓아 실험을 구성해요.",
  labs,
};

validateSubjectDefinition(modernDefinition, MODERN_LAB_IDS);
