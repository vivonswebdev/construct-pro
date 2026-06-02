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

  // Vehicules
  const vehiculesData = [
    { company_id: companyId, type: "Camionnette", brand: "Renault", model: "Master", year: 2021, plate: "1-ABC-123", current_km: 84300, cost_per_km: 0.42, ct_date: inDays(120), insurance_date: inDays(45), maintenance_date: inDays(-180), status: "Affecté" },
    { company_id: companyId, type: "Camion", brand: "Mercedes", model: "Actros", year: 2019, plate: "1-XYZ-789", current_km: 152800, cost_per_km: 0.95, ct_date: inDays(-12), insurance_date: inDays(220), maintenance_date: inDays(-95), status: "Disponible" },
    { company_id: companyId, type: "Voiture", brand: "Volkswagen", model: "Caddy", year: 2022, plate: "2-DEF-456", current_km: 41200, cost_per_km: 0.30, ct_date: inDays(18), insurance_date: inDays(310), maintenance_date: inDays(-60), status: "Disponible" },
    { company_id: companyId, type: "Engin", brand: "Bobcat", model: "S550", year: 2020, plate: "ENG-001", current_km: 2150, cost_per_km: 1.80, ct_date: inDays(200), insurance_date: inDays(95), maintenance_date: inDays(-400), status: "Affecté" },
  ];
  const { data: vehicules } = await supabase.from("vehicules").insert(vehiculesData).select();
  if (vehicules && vehicules.length >= 4) {
    await supabase.from("vehicule_affectations").insert([
      { vehicule_id: vehicules[0].id, chantier_id: chantiers[0].id, start_date: inDays(-60), start_km: 76800 },
      { vehicule_id: vehicules[3].id, chantier_id: chantiers[1].id, start_date: inDays(-30), start_km: 1900 },
      // Historique clôturé
      { vehicule_id: vehicules[1].id, chantier_id: chantiers[2].id, start_date: inDays(-180), end_date: inDays(-20), start_km: 140200, end_km: 152800 },
    ]);
  }


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
  if (onssRows.length) await supabase.from("onss_payments").insert(onssRows);

  // Factures & Devis seed
  const factSeed = [
    {
      type: "facture", number: `FAC-${currentY}-0001`, status: "Payée",
      client_name: chantiers[0].client_name, client_address: chantiers[0].address, client_vat: "BE0123456789",
      chantier_id: chantiers[0].id,
      issue_date: inDays(-75), due_date: inDays(-45), paid_date: inDays(-40), payment_reference: "VIR-2025-0001",
      vat_rate: 21, subtotal_ht: 35000, vat_amount: 7350, total_ttc: 42350,
      lignes: [
        { description: "Acompte travaux Résidence Les Acacias (30%)", quantity: 1, unit_price: 35000 },
      ],
    },
    {
      type: "facture", number: `FAC-${currentY}-0002`, status: "Envoyée",
      client_name: chantiers[1].client_name, client_address: chantiers[1].address, client_vat: "BE0456789012",
      chantier_id: chantiers[1].id,
      issue_date: inDays(-20), due_date: inDays(10),
      vat_rate: 21, subtotal_ht: 18500, vat_amount: 3885, total_ttc: 22385,
      lignes: [
        { description: "Travaux gros œuvre - entrepôt", quantity: 1, unit_price: 12500 },
        { description: "Fourniture matériaux divers", quantity: 1, unit_price: 6000 },
      ],
    },
    {
      type: "facture", number: `FAC-${currentY}-0003`, status: "En retard",
      client_name: "Construction Mahieu SA", client_address: "Rue de l'Industrie 5, 4040 Herstal",
      client_vat: "BE0234567890",
      chantier_id: null,
      issue_date: inDays(-60), due_date: inDays(-25),
      vat_rate: 6, subtotal_ht: 8200, vat_amount: 492, total_ttc: 8692,
      lignes: [
        { description: "Rénovation toiture (TVA 6% bâtiment > 10 ans)", quantity: 1, unit_price: 8200 },
      ],
    },
    {
      type: "devis", number: `DEV-${currentY}-0007`, status: "Envoyé",
      client_name: "Bureau d'architecture Mertens", client_address: "Place Saint-Lambert 12, 4000 Liège",
      client_vat: "BE0345678901",
      chantier_id: null,
      issue_date: inDays(-5), due_date: inDays(25),
      vat_rate: 21, subtotal_ht: 56000, vat_amount: 11760, total_ttc: 67760,
      lignes: [
        { description: "Gros œuvre extension villa - 180m²", quantity: 1, unit_price: 42000 },
        { description: "Couverture toiture inclinée", quantity: 1, unit_price: 14000 },
      ],
    },
    {
      type: "devis", number: `DEV-${currentY}-0008`, status: "Accepté",
      client_name: chantiers[0].client_name, client_address: chantiers[0].address, client_vat: "BE0123456789",
      chantier_id: chantiers[0].id,
      issue_date: inDays(-100), due_date: inDays(-70),
      vat_rate: 21, subtotal_ht: 245000, vat_amount: 51450, total_ttc: 296450,
      lignes: [
        { description: "Construction immeuble résidentiel 12 appartements - prestations globales", quantity: 1, unit_price: 245000 },
      ],
    },
  ];

  for (const f of factSeed) {
    const { lignes, ...factRow } = f as any;
    const { data: inserted } = await (supabase.from("factures" as any) as any)
      .insert({ ...factRow, company_id: companyId })
      .select()
      .single();
    if (inserted && lignes) {
      await (supabase.from("facture_lignes" as any) as any).insert(
        (lignes as any[]).map((l, i) => ({
          facture_id: inserted.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total_ht: l.quantity * l.unit_price,
          order_index: i,
        }))
      );
    }
  }
}
