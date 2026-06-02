import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PHASES = [
  "Préparation du site",
  "Fondations",
  "Gros œuvre",
  "Charpente & Toiture",
  "Second œuvre (électricité, plomberie)",
  "Finitions & Peinture",
  "Nettoyage & Réception",
];

export async function seedDataIfEmpty(companyId: string) {
  const { count } = await supabase
    .from("chantiers")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if ((count ?? 0) > 0) return;

  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const chantiersData = [
    {
      company_id: companyId,
      name: "Résidence Les Acacias",
      client_name: "Immobilière Dumont SA",
      address: "Rue des Acacias 14, 4000 Liège",
      budget: 245000,
      actual_costs: 162400,
      start_date: inDays(-90),
      end_date: inDays(74),
      status: "En cours",
      progress: 68,
      description: "Construction d'un immeuble résidentiel de 12 appartements.",
    },
    {
      company_id: companyId,
      name: "Entrepôt Logistique Seraing",
      client_name: "TechLog BVBA",
      address: "Quai des Carmes 8, 4100 Seraing",
      budget: 180000,
      actual_costs: 98200,
      start_date: inDays(-120),
      end_date: inDays(-30),
      status: "En retard",
      progress: 41,
      description: "Extension d'entrepôt logistique 1500m².",
    },
    {
      company_id: companyId,
      name: "Villa Rénovation Namur",
      client_name: "M. & Mme Pirard",
      address: "Avenue de la Citadelle 22, 5000 Namur",
      budget: 68000,
      actual_costs: 56600,
      start_date: inDays(-180),
      end_date: inDays(-15),
      status: "Terminé",
      progress: 100,
      description: "Rénovation complète d'une villa de 220m².",
    },
  ];

  const { data: chantiers, error: cErr } = await supabase
    .from("chantiers")
    .insert(chantiersData)
    .select();
  if (cErr || !chantiers) return;

  // Etapes
  const etapesRows = chantiers.flatMap((c) =>
    DEFAULT_PHASES.map((name, i) => {
      const prog = c.progress;
      const stagePct = Math.max(0, Math.min(100, (prog - (i * 100) / 7) * 7 / 1));
      const phaseProgress = Math.max(0, Math.min(100, Math.round(stagePct)));
      let status = "En attente";
      if (phaseProgress >= 100) status = "Terminé";
      else if (phaseProgress > 0) status = "En cours";
      return {
        chantier_id: c.id,
        name,
        order_index: i,
        progress: phaseProgress,
        status,
      };
    })
  );
  await supabase.from("etapes").insert(etapesRows);

  // Personnel
  const personnelData = [
    { full_name: "Marc Dubois", contract_type: "CDI", hourly_rate: 24.5, nrn: "85.04.12-345.67", email: "marc.dubois@example.be", phone: "+32 478 12 34 56" },
    { full_name: "Julien Lefèvre", contract_type: "CDI", hourly_rate: 23.0, nrn: "82.09.30-123.45", email: "j.lefevre@example.be", phone: "+32 479 22 33 44" },
    { full_name: "Ahmed Benali", contract_type: "CDD", hourly_rate: 21.5, nrn: "90.06.18-432.10", email: "a.benali@example.be", phone: "+32 471 11 22 33" },
    { full_name: "Sophie Vandenberg", contract_type: "Intérim", hourly_rate: 19.0, nrn: "92.11.05-678.90", email: "s.vandenberg@example.be", phone: "+32 472 55 66 77" },
    { full_name: "Pierre Goossens", contract_type: "Indépendant", hourly_rate: 35.0, nrn: "78.02.22-111.22", email: "p.goossens@example.be", phone: "+32 470 99 88 77" },
  ].map((p) => ({ ...p, company_id: companyId, status: "Actif" }));

  const { data: personnel } = await supabase.from("personnel").insert(personnelData).select();
  if (!personnel) return;

  // Presence for current month
  const presenceRows: any[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (const p of personnel) {
    for (let d = 1; d <= Math.min(daysInMonth, now.getDate()); d++) {
      const date = new Date(year, month, d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const r = Math.random();
      let status: string = "Présent";
      if (r < 0.05) status = "Absent";
      else if (r < 0.1) status = "Congé";
      presenceRows.push({
        personnel_id: p.id,
        date: date.toISOString().slice(0, 10),
        status,
        hours: status === "Présent" ? 8 : 0,
        chantier_id: status === "Présent" ? chantiers[Math.floor(Math.random() * 2)].id : null,
      });
    }
  }
  if (presenceRows.length) await supabase.from("presence").insert(presenceRows);

  // Affectations
  await supabase.from("affectations").insert([
    { personnel_id: personnel[0].id, chantier_id: chantiers[0].id, start_date: inDays(-60), role: "Chef d'équipe" },
    { personnel_id: personnel[1].id, chantier_id: chantiers[0].id, start_date: inDays(-60), role: "Maçon" },
    { personnel_id: personnel[2].id, chantier_id: chantiers[1].id, start_date: inDays(-90), role: "Maçon" },
    { personnel_id: personnel[3].id, chantier_id: chantiers[0].id, start_date: inDays(-30), role: "Manœuvre" },
  ]);

  // TVA checks seed: 2 green, 1 red
  await supabase.from("tva_checks").insert([
    {
      company_id: companyId,
      client_name: "Immobilière Dumont SA",
      client_vat_number: "BE0123456789",
      is_eligible: true,
      raw_response: { message: "Aucune retenue obligatoire" },
    },
    {
      company_id: companyId,
      client_name: "TechLog BVBA",
      client_vat_number: "BE0456789012",
      is_eligible: true,
      raw_response: { message: "Aucune retenue obligatoire" },
    },
    {
      company_id: companyId,
      client_name: "Sous-traitant Dubois SPRL",
      client_vat_number: "BE0789012345",
      is_eligible: false,
      raw_response: { message: "Retenue obligatoire — dettes fiscales détectées" },
    },
  ]);

  // Salary / précompte / ONSS seed
  const contractWorkers = personnel.filter((p) => ["CDI", "CDD", "Intérim"].includes(p.contract_type ?? ""));
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1; // 1-12
  const currentQuarter = Math.floor((currentM - 1) / 3) + 1;

  const salaryRows: any[] = [];
  const precompteRows: any[] = [];
  for (const w of contractWorkers) {
    const gross = Number(w.hourly_rate ?? 20) * 8 * 22;
    const net = Math.round(gross * 0.69 * 100) / 100;
    const prec = Math.round(gross * 0.18 * 100) / 100;
    // Current month: unpaid
    salaryRows.push({
      company_id: companyId, personnel_id: w.id,
      period_month: currentM, period_year: currentY,
      gross_amount: gross, net_amount: net, paid: false,
    });
    precompteRows.push({
      company_id: companyId, personnel_id: w.id,
      period_month: currentM, period_year: currentY,
      amount: prec, paid: false,
    });
    // Previous 2 months: paid
    for (let back = 1; back <= 2; back++) {
      const d = new Date(currentY, currentM - 1 - back, 1);
      salaryRows.push({
        company_id: companyId, personnel_id: w.id,
        period_month: d.getMonth() + 1, period_year: d.getFullYear(),
        gross_amount: gross, net_amount: net, paid: true,
        paid_date: new Date(d.getFullYear(), d.getMonth(), 28).toISOString().slice(0, 10),
        reference: `VIR-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
      precompteRows.push({
        company_id: companyId, personnel_id: w.id,
        period_month: d.getMonth() + 1, period_year: d.getFullYear(),
        amount: prec, paid: true,
        paid_date: new Date(d.getFullYear(), d.getMonth() + 1, 14).toISOString().slice(0, 10),
        reference: `SPF-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
  }
  if (salaryRows.length) await supabase.from("salary_payments").insert(salaryRows);
  if (precompteRows.length) await supabase.from("precompte_payments").insert(precompteRows);

  // ONSS: Q1 paid, current quarter unpaid for everyone
  const onssRows: any[] = [];
  for (const w of contractWorkers) {
    const gross = Number(w.hourly_rate ?? 20) * 8 * 22;
    const amt = Math.round(gross * 3 * 0.40 * 100) / 100;
    if (currentQuarter > 1) {
      onssRows.push({
        company_id: companyId, personnel_id: w.id,
        quarter: 1, year: currentY,
        amount: amt, paid: true,
        paid_date: `${currentY}-04-25`,
        reference: `ONSS-${currentY}-Q1`,
      });
    }
    if (currentQuarter >= 2) {
      onssRows.push({
        company_id: companyId, personnel_id: w.id,
        quarter: currentQuarter, year: currentY,
        amount: amt, paid: false,
      });
    } else {
      onssRows.push({
        company_id: companyId, personnel_id: w.id,
        quarter: 1, year: currentY,
        amount: amt, paid: false,
      });
    }
  }
  if (onssRows.length) await supabase.from("salary_payments" === "salary_payments" ? "onss_payments" : "onss_payments").insert(onssRows);
}
