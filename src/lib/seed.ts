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

/**
 * Seeds demo data exactly once per company.
 * The DB function seed_lock atomically flips companies.demo_seeded
 * (false -> true) and only returns a row for the first caller, so parallel
 * calls can never duplicate data.
 */
export async function seedDataIfEmpty(companyId: string): Promise<boolean> {
  const { data: locked, error: lockErr } = await supabase.rpc("seed_lock", { _company_id: companyId });
  if (lockErr || !locked) return false;

  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Clients: 3 particuliers, 3 entreprises (2 assujettis)
  const clientsSeed = [
    { type: "entreprise", raison_sociale: "Immobilière Dumont SA", nom: "Dumont", numero_bce: "0123.456.789", numero_tva: "BE0123456789", assujetti_tva: true, adresse: "Rue des Acacias 14", code_postal: "4000", ville: "Liège", email: "contact@dumont-immo.be", telephone: "+32 4 222 33 44", langue: "FR" },
    { type: "entreprise", raison_sociale: "TechLog BV", nom: "Janssens", numero_bce: "0456.789.012", numero_tva: "BE0456789012", assujetti_tva: true, adresse: "Industrieweg 8", code_postal: "3500", ville: "Hasselt", email: "info@techlog.be", telephone: "+32 11 45 67 89", langue: "NL" },
    { type: "entreprise", raison_sociale: "ASBL Les Jardins du Cœur", nom: "Lambert", numero_bce: "0678.901.234", numero_tva: null, assujetti_tva: false, adresse: "Place du Marché 3", code_postal: "5000", ville: "Namur", email: "direction@jardinsducoeur.be", telephone: "+32 81 12 34 56", langue: "FR" },
    { type: "particulier", prenom: "Luc", nom: "Pirard", adresse: "Avenue de la Citadelle 22", code_postal: "5000", ville: "Namur", email: "luc.pirard@gmail.com", telephone: "+32 475 12 34 56", langue: "FR" },
    { type: "particulier", prenom: "Anne", nom: "Collignon", adresse: "Rue Haute 51", code_postal: "1300", ville: "Wavre", email: "anne.collignon@skynet.be", telephone: "+32 476 98 76 54", langue: "FR" },
    { type: "particulier", prenom: "Pieter", nom: "Vermeulen", adresse: "Kerkstraat 17", code_postal: "9000", ville: "Gent", email: "p.vermeulen@telenet.be", telephone: "+32 477 55 44 33", langue: "NL" },
  ].map((c) => ({ raison_sociale: null, numero_bce: null, numero_tva: null, assujetti_tva: false, prenom: null, ...c, company_id: companyId }));
  const { data: clientsRows } = await supabase.from("clients").insert(clientsSeed as any).select();
  const cl = (clientsRows ?? []) as any[];
  const cName = (c: any) => c ? (c.type === "entreprise" ? c.raison_sociale : `${c.prenom} ${c.nom}`) : null;
  const cAddr = (c: any) => c ? `${c.adresse}, ${c.code_postal} ${c.ville}` : null;

  // Chantiers: 2 en cours dans les temps, 1 en retard, 1 terminé, 1 en préparation
  const chantiersData = [
    { client: cl[0], name: "Résidence Les Acacias", budget: 245000, actual_costs: 142400, start_date: inDays(-90), end_date: inDays(120), status: "En cours", progress: 55, description: "Construction d'un immeuble résidentiel de 12 appartements." },
    { client: cl[4], name: "Extension maison Collignon", budget: 86000, actual_costs: 31200, start_date: inDays(-40), end_date: inDays(80), status: "En cours", progress: 35, description: "Extension de 45 m² avec toiture plate et baie vitrée." },
    { client: cl[1], name: "Entrepôt Logistique Hasselt", budget: 180000, actual_costs: 128200, start_date: inDays(-150), end_date: inDays(-20), status: "En retard", progress: 72, description: "Extension d'entrepôt logistique 1 500 m²." },
    { client: cl[3], name: "Villa Rénovation Namur", budget: 68000, actual_costs: 56600, start_date: inDays(-200), end_date: inDays(-25), status: "Terminé", progress: 100, description: "Rénovation complète d'une villa de 220 m² (TVA 6 %)." },
    { client: cl[2], name: "Salle polyvalente ASBL", budget: 132000, actual_costs: 0, start_date: inDays(30), end_date: inDays(240), status: "En attente", progress: 0, description: "En préparation — construction d'une salle polyvalente de 300 m²." },
  ].map(({ client, ...c }) => ({ ...c, company_id: companyId, client_id: client?.id ?? null, client_name: cName(client), address: cAddr(client) }));

  const { data: chantiers, error: cErr } = await supabase.from("chantiers").insert(chantiersData as any).select();
  if (cErr || !chantiers) return true;

  // Etapes
  const etapesRows = chantiers.flatMap((c) =>
    DEFAULT_PHASES.map((name, i) => {
      const phaseProgress = Math.max(0, Math.min(100, Math.round((c.progress - (i * 100) / 7) * 7)));
      let status = "En attente";
      if (phaseProgress >= 100) status = "Terminé";
      else if (phaseProgress > 0) status = "En cours";
      return { chantier_id: c.id, name, order_index: i, progress: phaseProgress, status };
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
  if (!personnel) return true;

  // Presence for current month
  const presenceRows: any[] = [];
  const now = new Date();
  const yr = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(yr, month + 1, 0).getDate();
  for (const p of personnel) {
    for (let d = 1; d <= Math.min(daysInMonth, now.getDate()); d++) {
      const date = new Date(yr, month, d);
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

  // Véhicules : 7 (3 camionnettes, 1 camion benne, 1 mini-pelle, 1 remorque, 1 voiture dirigeant)
  const vehiculesData = [
    { type: "Camionnette", brand: "Ford", model: "Transit", year: 2021, plate: "1-ABC-123", current_km: 84300, cost_per_km: 0.42, ct_date: inDays(15), insurance_date: inDays(145), maintenance_date: inDays(40), status: "Affecté" },
    { type: "Camionnette", brand: "Renault", model: "Master", year: 2020, plate: "1-DEF-456", current_km: 112500, cost_per_km: 0.45, ct_date: inDays(190), insurance_date: inDays(60), maintenance_date: inDays(-10), status: "Affecté" },
    { type: "Camionnette", brand: "Volkswagen", model: "Crafter", year: 2023, plate: "2-GHI-789", current_km: 28400, cost_per_km: 0.40, ct_date: inDays(420), insurance_date: inDays(260), maintenance_date: inDays(120), status: "Disponible" },
    { type: "Camion", brand: "MAN", model: "TGS 26.400 benne", year: 2019, plate: "1-JKL-012", current_km: 152800, cost_per_km: 0.95, ct_date: inDays(75), insurance_date: inDays(30), maintenance_date: inDays(-35), status: "Affecté" },
    { type: "Engin", brand: "Kubota", model: "U27-4 mini-pelle", year: 2021, plate: "ENG-001", current_km: 2150, cost_per_km: 1.80, ct_date: inDays(300), insurance_date: inDays(95), maintenance_date: inDays(20), status: "Affecté" },
    { type: "Remorque", brand: "Humbaur", model: "HT 3.5t", year: 2018, plate: "Q-REM-345", current_km: 0, cost_per_km: 0.08, ct_date: inDays(230), insurance_date: inDays(180), maintenance_date: inDays(160), status: "Disponible" },
    { type: "Voiture", brand: "BMW", model: "520e hybride", year: 2024, plate: "2-MNO-678", current_km: 18600, cost_per_km: 0.35, ct_date: inDays(900), insurance_date: inDays(210), maintenance_date: inDays(95), status: "Disponible" },
  ].map((v) => ({ ...v, company_id: companyId }));
  const { data: vehicules } = await supabase.from("vehicules").insert(vehiculesData).select();
  if (vehicules && vehicules.length >= 7) {
    await supabase.from("vehicule_affectations").insert([
      { vehicule_id: vehicules[0].id, chantier_id: chantiers[0].id, start_date: inDays(-60), start_km: 79800 },
      { vehicule_id: vehicules[1].id, chantier_id: chantiers[1].id, start_date: inDays(-35), start_km: 110900 },
      { vehicule_id: vehicules[3].id, chantier_id: chantiers[2].id, start_date: inDays(-45), start_km: 150100 },
      { vehicule_id: vehicules[4].id, chantier_id: chantiers[0].id, start_date: inDays(-30), start_km: 1900 },
      { vehicule_id: vehicules[2].id, chantier_id: chantiers[3].id, start_date: inDays(-190), end_date: inDays(-25), start_km: 21000, end_km: 27900 },
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
      client_name: "Sous-traitant Dubois SRL",
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

  // Devis : 8 statuts variés avec lignes détaillées
  type L = [string, number, number, number?]; // description, qty, unit_price, vat
  const devisSeed: { client: any; chantier?: any; status: string; issue: number; valid: number; autoliq?: boolean; att6?: boolean; lignes: L[] }[] = [
    { client: cl[0], chantier: chantiers[0], status: "Accepté", issue: -110, valid: -80, autoliq: true, lignes: [
      ["Terrassement et évacuation des terres", 850, 18, 0], ["Fondations en béton armé", 1, 38500, 0], ["Gros œuvre maçonnerie (blocs béton)", 1, 112000, 0], ["Charpente et toiture tuiles", 1, 54500, 0], ["Menuiseries extérieures PVC", 1, 40000, 0] ] },
    { client: cl[4], chantier: chantiers[1], status: "Accepté", issue: -55, valid: -25, lignes: [
      ["Terrassement et fondations", 1, 9800, 21], ["Gros œuvre extension 45 m²", 45, 950, 21], ["Toiture plate EPDM + isolant PUR", 45, 185, 21], ["Baie vitrée alu 4 m", 1, 6450, 21], ["Raccordements et finitions", 1, 18500, 21] ] },
    { client: cl[1], chantier: chantiers[2], status: "Accepté", issue: -170, valid: -140, autoliq: true, lignes: [
      ["Dalle industrielle béton 1 500 m²", 1500, 62, 0], ["Structure acier et bardage", 1, 58000, 0], ["Toiture bac acier isolée", 1, 29000, 0] ] },
    { client: cl[3], chantier: chantiers[3], status: "Accepté", issue: -220, valid: -190, att6: true, lignes: [
      ["Démolition et évacuation", 1, 6200, 6], ["Remplacement toiture complète", 180, 145, 6], ["Isolation murs par l'intérieur", 220, 48, 6], ["Électricité mise en conformité RGIE", 1, 9800, 6], ["Peinture et finitions", 1, 12040, 6] ] },
    { client: cl[5], status: "Envoyé", issue: -8, valid: 22, att6: true, lignes: [
      ["Rénovation salle de bain complète", 1, 14500, 6], ["Remplacement châssis double vitrage", 6, 1150, 6], ["Carrelage sol 35 m²", 35, 72, 6] ] },
    { client: cl[2], status: "Brouillon", issue: -2, valid: 28, lignes: [
      ["Terrassement salle polyvalente", 1, 12500, 21], ["Fondations et dalle", 1, 34000, 21], ["Gros œuvre et toiture", 1, 71000, 21], ["Techniques spéciales (HVAC)", 1, 14500, 21] ] },
    { client: cl[4], status: "Refusé", issue: -70, valid: -40, lignes: [
      ["Aménagement abri de jardin", 1, 7800, 21], ["Terrasse bois exotique 30 m²", 30, 165, 21] ] },
    { client: cl[1], status: "Expiré", issue: -95, valid: -65, autoliq: true, lignes: [
      ["Extension bureaux mezzanine", 120, 480, 0], ["Cloisons plaques de plâtre", 180, 42, 0] ] },
  ];
  const yr4 = today.getFullYear();
  for (const [i, d] of devisSeed.entries()) {
    const lignes = d.lignes.map(([description, quantity, unit_price, vat]) => ({ description, quantity, unit_price, vat_rate: d.autoliq ? 0 : (vat ?? 21) }));
    const subtotal = lignes.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const vatAmount = lignes.reduce((s, l) => s + (l.quantity * l.unit_price * l.vat_rate) / 100, 0);
    const mainRate = lignes[0]?.vat_rate ?? 21;
    const { data: inserted } = await supabase.from("factures").insert({
      company_id: companyId, type: "devis", number: `DEV-${yr4}-${String(i + 1).padStart(4, "0")}`,
      status: d.status, client_id: d.client?.id ?? null, client_name: cName(d.client) ?? "Client",
      client_address: cAddr(d.client), client_vat: d.client?.numero_tva ?? null,
      chantier_id: d.chantier?.id ?? null, issue_date: inDays(d.issue), valid_until: inDays(d.valid), due_date: inDays(d.valid),
      vat_rate: mainRate, subtotal_ht: subtotal, vat_amount: vatAmount, total_ttc: subtotal + vatAmount,
      autoliquidation: !!d.autoliq, attestation_6: !!d.att6,
      conditions: "Devis valable 30 jours. Acompte de 30 % à la commande.",
    } as any).select().single();
    if (inserted) {
      await supabase.from("facture_lignes").insert(lignes.map((l, idx) => ({
        facture_id: inserted.id, ...l, total_ht: l.quantity * l.unit_price, order_index: idx,
      })) as any);
    }
  }

  // Stock : 20 matériaux (3 sous le minimum)
  const matSeed = [
    { name: "Ciment Portland CEM I 42.5N", sku: "CIM-425", unit: "sac 25kg", unit_price: 6.5, stock_quantity: 120, min_stock: 30, supplier: "Holcim", category: "Gros œuvre" },
    { name: "Sable de rivière 0/4", sku: "SAB-04", unit: "m³", unit_price: 38, stock_quantity: 12, min_stock: 5, supplier: "Carrières du Hainaut", category: "Granulats" },
    { name: "Gravier concassé 4/14", sku: "GRV-414", unit: "m³", unit_price: 42, stock_quantity: 9, min_stock: 4, supplier: "Carrières du Hainaut", category: "Granulats" },
    { name: "Bloc béton 39x19x14", sku: "BLC-14", unit: "pièce", unit_price: 1.45, stock_quantity: 1800, min_stock: 500, supplier: "Ebema", category: "Maçonnerie" },
    { name: "Bloc béton 39x19x19", sku: "BLC-19", unit: "pièce", unit_price: 1.85, stock_quantity: 320, min_stock: 400, supplier: "Ebema", category: "Maçonnerie" },
    { name: "Brique de parement rouge", sku: "BRQ-PAR", unit: "pièce", unit_price: 0.85, stock_quantity: 4500, min_stock: 1000, supplier: "Wienerberger", category: "Maçonnerie" },
    { name: "Fer à béton HA 12mm (6m)", sku: "FER-12", unit: "barre", unit_price: 9.8, stock_quantity: 140, min_stock: 50, supplier: "ArcelorMittal", category: "Armatures" },
    { name: "Treillis soudé 150x150x8", sku: "TRS-8", unit: "panneau", unit_price: 34, stock_quantity: 45, min_stock: 10, supplier: "ArcelorMittal", category: "Armatures" },
    { name: "Mortier de maçonnerie", sku: "MRT-25", unit: "sac 25kg", unit_price: 5.2, stock_quantity: 85, min_stock: 25, supplier: "Weber", category: "Gros œuvre" },
    { name: "Plaque de plâtre BA13", sku: "PLQ-13", unit: "plaque", unit_price: 7.9, stock_quantity: 60, min_stock: 40, supplier: "Gyproc", category: "Finitions" },
    { name: "Rail métallique R48", sku: "RAIL-48", unit: "barre 3m", unit_price: 3.4, stock_quantity: 110, min_stock: 40, supplier: "Gyproc", category: "Finitions" },
    { name: "Isolant PUR 120mm", sku: "PUR-120", unit: "m²", unit_price: 21.5, stock_quantity: 63, min_stock: 60, supplier: "Recticel", category: "Isolation" },
    { name: "Laine de roche 100mm", sku: "ISO-LR100", unit: "m²", unit_price: 11.2, stock_quantity: 140, min_stock: 50, supplier: "Rockwool", category: "Isolation" },
    { name: "Membrane EPDM 1.2mm", sku: "EPDM-12", unit: "m²", unit_price: 14.5, stock_quantity: 95, min_stock: 30, supplier: "Firestone", category: "Toiture" },
    { name: "Tuile béton anthracite", sku: "TUI-ANT", unit: "pièce", unit_price: 1.25, stock_quantity: 900, min_stock: 300, supplier: "Monier", category: "Toiture" },
    { name: "Chevron sapin 63x175 (5m)", sku: "CHV-63", unit: "pièce", unit_price: 18.9, stock_quantity: 36, min_stock: 15, supplier: "Van Hoorebeke", category: "Bois" },
    { name: "Plaque OSB3 18mm", sku: "OSB-18", unit: "panneau", unit_price: 32, stock_quantity: 40, min_stock: 10, supplier: "Egger", category: "Bois" },
    { name: "Tube PVC évacuation Ø110", sku: "PVC-110", unit: "barre 3m", unit_price: 12.6, stock_quantity: 28, min_stock: 10, supplier: "Wavin", category: "Égouttage" },
    { name: "Vis à bois 5x60mm", sku: "VIS-560", unit: "boîte 200", unit_price: 11.9, stock_quantity: 6, min_stock: 15, supplier: "Spit", category: "Visserie" },
    { name: "Enduit de façade blanc", sku: "END-FAC", unit: "sac 25kg", unit_price: 17.5, stock_quantity: 44, min_stock: 20, supplier: "Weber", category: "Finitions" },
  ].map((m) => ({ ...m, company_id: companyId }));
  const { data: materiaux } = await supabase.from("materiaux").insert(matSeed).select();

  if (materiaux && materiaux.length) {
    const m = (sku: string) => (materiaux as any[]).find((x) => x.sku === sku);
    // Entries insert with trigger → adjust stock; keep net effect small but realistic.
    const mv = (sku: string, chIdx: number | null, type: string, quantity: number, day: number, extra: any = {}) => {
      const mat = m(sku);
      if (!mat) return null;
      return { company_id: companyId, materiau_id: mat.id, chantier_id: chIdx === null ? null : chantiers[chIdx].id, type, quantity, unit_price: mat.unit_price, total: quantity * Number(mat.unit_price), date: inDays(day), ...extra };
    };
    const mvts = [
      mv("CIM-425", 0, "achat", 60, -45, { supplier: "Holcim", reference: "BC-0871" }),
      mv("CIM-425", 0, "sortie", 40, -30, { notes: "Fondations" }),
      mv("FER-12", 0, "sortie", 80, -28, { notes: "Armatures semelles" }),
      mv("BLC-14", 0, "sortie", 1200, -15, { notes: "Murs RDC" }),
      mv("SAB-04", 1, "achat", 6, -25, { supplier: "Carrières du Hainaut", reference: "BL-22458" }),
      mv("BLC-19", 1, "sortie", 280, -12, { notes: "Murs extension" }),
      mv("PUR-120", 1, "sortie", 45, -5, { notes: "Toiture plate" }),
      mv("EPDM-12", 1, "sortie", 48, -4, { notes: "Étanchéité toiture" }),
      mv("TRS-8", 2, "sortie", 30, -60, { notes: "Dalle industrielle" }),
      mv("OSB-18", 2, "sortie", 12, -20, { notes: "Coffrage" }),
      mv("OSB-18", 2, "retour", 2, -18, { notes: "Surplus coffrage" }),
      mv("PLQ-13", 3, "sortie", 70, -60, { notes: "Cloisons intérieures" }),
      mv("END-FAC", 3, "sortie", 16, -40, { notes: "Façade" }),
      mv("PLQ-13", null, "achat", 80, -10, { supplier: "Gyproc", reference: "BC-0903" }),
    ].filter(Boolean);
    if (mvts.length) await supabase.from("stock_mouvements").insert(mvts as any);
  }

  return true;
}
