// All on-screen text. Take wording from the product's own landing page / app so the
// film says exactly what the product says. One object per language.
export const copy = {
  en: {
    titles: { hook: "Your quarterly report?", file: "report_final_v", turn: "There's a better way.", end: "Every account. One clear answer." },
    disclaimer: "Illustrative data",
    ask: "Ask your accounts…",
    question: "Which accounts need attention first?",
    status: "Checking usage, renewals and invoices",
    answer: "Northwind Retail comes first: usage fell 31 % in 90 days and two renewals are due.",
    list: { title: "Accounts", sort: "Sort", sortValue: "Risk ↓" },
    detail: { name: "Northwind Retail", meta: "Retail · 42 stores · since 2019", kpis: ["Health", "Churn risk", "Revenue at risk", "Data confidence"], risk: "High" },
    chart: { title: "Monthly active usage", unit: "k sessions" },
    insight: { title: "Why this account", reasons: [["Usage down 31 % in 90 days", "Three of four regions declining."], ["Two renewals due in Q4", "€1.2M of annual revenue."]], sources: ["Usage logs", "CRM", "Invoices"] },
  },
};

export type Copy = (typeof copy)["en"];

// Rows arrive unsorted, then settle into risk order (lowest score first).
export const rows = [
  { name: "Northwind Retail", score: 38 },
  { name: "Bluebird Logistics", score: 44 },
  { name: "Kestrel Health", score: 51 },
  { name: "Orchard Foods", score: 57 },
  { name: "Harbor Energy", score: 63 },
  { name: "Lumen Studio", score: 70 },
  { name: "Pine & Co.", score: 76 },
  { name: "Atlas Mobility", score: 82 },
  { name: "Vela Systems", score: 88 },
];
export const arrival = [4, 0, 7, 2, 8, 1, 6, 3, 5]; // slot each row appears in before sorting
export const usage = [62, 64, 61, 66, 63, 60, 58, 55, 51, 47, 45, 43]; // last 12 months

export const tone = (score: number) => (score < 50 ? "red" : score < 70 ? "amber" : "green");
