// Tests des calculs du timesheet (périodes, durées, totaux).
// Lancer : bun scripts/tests/timesheet.check.ts

import {
  dureeSaisie,
  formatDuree,
  grille,
  heuresDecimales,
  joursEntre,
  periode,
  periodeVoisine,
  semaineIso,
  totalMinutes,
  totauxPar,
} from "../../src/lib/timesheet";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

ok(eq(periode("jour", "2026-10-21"), { debut: "2026-10-21", fin: "2026-10-21" }), "période jour");
ok(
  eq(periode("semaine", "2026-10-21"), { debut: "2026-10-19", fin: "2026-10-25" }),
  "semaine du lundi au dimanche (mercredi)",
);
ok(
  eq(periode("semaine", "2026-10-25"), { debut: "2026-10-19", fin: "2026-10-25" }),
  "semaine : un dimanche reste dans la semaine qui finit",
);
ok(
  eq(periode("mois", "2026-02-14"), { debut: "2026-02-01", fin: "2026-02-28" }),
  "mois de février",
);
ok(
  eq(periode("semaine", "2026-03-30"), { debut: "2026-03-30", fin: "2026-04-05" }),
  "semaine à cheval sur le passage à l'heure d'été",
);
ok(periodeVoisine("mois", "2026-01-31", 1) === "2026-02-01", "mois suivant depuis le 31");
ok(periodeVoisine("semaine", "2026-10-21", -1) === "2026-10-14", "semaine précédente");
ok(joursEntre("2026-10-30", "2026-11-02").length === 4, "jours entre deux dates (inclus)");
ok(semaineIso("2026-10-21") === 43 && semaineIso("2027-01-01") === 53, "numéro de semaine ISO");
ok(
  formatDuree(450) === "7:30" && formatDuree(5) === "0:05" && formatDuree(null) === "—",
  "format 7:30",
);
ok(heuresDecimales(450) === 7.5 && heuresDecimales(20) === 0.33, "heures décimales");
ok(dureeSaisie("07:30", "16:00", 30) === 480, "durée saisie, pause déduite");
ok(
  dureeSaisie("16:00", "07:30", 0) === null && dureeSaisie("08:00", "09:00", 60) === null,
  "durée incohérente refusée (départ avant arrivée, pause trop longue)",
);

const pts = [
  { personnel_id: "w1", chantier_id: "c1", date: "2026-10-19", minutes_travaillees: 480 },
  { personnel_id: "w1", chantier_id: "c2", date: "2026-10-19", minutes_travaillees: 60 },
  { personnel_id: "w2", chantier_id: "c1", date: "2026-10-20", minutes_travaillees: 450 },
  { personnel_id: "w2", chantier_id: "c1", date: "2026-10-21", minutes_travaillees: null },
];
const parT = totauxPar(pts, (p) => p.personnel_id);
const parC = totauxPar(pts, (p) => p.chantier_id);
ok(parT.get("w1") === 540 && parT.get("w2") === 450, "totaux par travailleur");
ok(parC.get("c1") === 930 && parC.get("c2") === 60, "totaux par chantier");
ok(totalMinutes(pts) === 990, "total de la période (pointage en cours ignoré)");
ok(grille(pts).get("w1")?.get("2026-10-19") === 540, "grille : cumul par jour");

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
