import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import i18n from "@/lib/i18n";
import { formatEURBE, formatVATDisplay } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { header, lastTableY } from "@/lib/pdf";
import { pdfSafe as s } from "@/lib/contrats/pdf";
import { etatSignature, lienSignature } from "@/lib/contrats/signature";
import {
  EXIGENCES,
  statutDocument,
  type LigneConformite,
  type StatutConformite,
} from "@/lib/conformite";
import { aujourdhuiBruxelles, formatBCE } from "@/lib/sous-traitants";
import { BUCKET_DOCUMENTS } from "@/lib/stockage";
import { nomFichier } from "./csv";
import { dateHeureBruxelles, pied } from "./rendus";
import { statutVerification, syntheseConformite, type SyntheseConformite } from "./registre";

const MAX_CAPTURES = 20;

/** Données du dossier (RLS : société de l'utilisateur). */
export async function chargerDossier(sousTraitantId: string) {
  const id = sousTraitantId;
  const [st, conf, docs, verifs, contrats, derogs] = await Promise.all([
    supabase.from("sous_traitants").select("*").eq("id", id).single(),
    supabase.rpc("conformite_sous_traitants"),
    supabase
      .from("documents_conformite")
      .select("*")
      .eq("sous_traitant_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("verifications_30bis")
      .select("*")
      .eq("sous_traitant_id", id)
      .order("verifie_le", { ascending: false }),
    supabase
      .from("sous_traitant_contrats")
      .select("*")
      .eq("sous_traitant_id", id)
      .order("date_debut", { ascending: false }),
    supabase
      .from("derogations_conformite")
      .select("*")
      .eq("sous_traitant_id", id)
      .order("accordee_le", { ascending: false }),
  ]);
  if (st.error) throw st.error;
  const contratIds = (contrats.data ?? []).map((c) => c.id);
  const chantierIds = [
    ...new Set((contrats.data ?? []).map((c) => c.chantier_id).filter((x): x is string => !!x)),
  ];
  const [paiements, signatures, chantiers] = await Promise.all([
    contratIds.length
      ? supabase
          .from("achat_paiements")
          .select("*")
          .in("contrat_id", contratIds)
          .order("date_paiement", { ascending: false })
      : Promise.resolve({ data: [] as Tables<"achat_paiements">[] }),
    contratIds.length
      ? supabase
          .from("contrat_signatures")
          .select("contrat_id, statut, expire_le, signe_le, token, created_at")
          .in("contrat_id", contratIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            contrat_id: string;
            statut: string;
            expire_le: string;
            signe_le: string | null;
            token: string;
            created_at: string;
          }[],
        }),
    chantierIds.length
      ? supabase.from("chantiers").select("id, name, client_name").in("id", chantierIds)
      : Promise.resolve({ data: [] as { id: string; name: string; client_name: string | null }[] }),
  ]);
  return {
    st: st.data,
    ligne: ((conf.data ?? []) as LigneConformite[]).find((l) => l.sous_traitant_id === id) ?? null,
    documents: docs.data ?? [],
    verifications: verifs.data ?? [],
    contrats: contrats.data ?? [],
    derogations: derogs.data ?? [],
    paiements: paiements.data ?? [],
    signatures: signatures.data ?? [],
    chantiers: new Map((chantiers.data ?? []).map((c) => [c.id, c])),
  };
}

export type Dossier = Awaited<ReturnType<typeof chargerDossier>>;

/** Captures JPG / PNG des vérifications, en data URL (les PDF ne s'intègrent pas). */
async function chargerCaptures(d: Dossier) {
  const out = new Map<string, { url: string; format: "JPEG" | "PNG" }>();
  const aCharger = d.verifications
    .filter((v) => v.preuve_fichier && /\.(jpg|png)$/.test(v.preuve_fichier))
    .slice(0, MAX_CAPTURES);
  await Promise.all(
    aCharger.map(async (v) => {
      const { data } = await supabase.storage.from(BUCKET_DOCUMENTS).download(v.preuve_fichier!);
      if (!data) return;
      const url = await new Promise<string>((ok, ko) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = ko;
        r.readAsDataURL(data);
      });
      out.set(v.id, { url, format: v.preuve_fichier!.endsWith(".png") ? "PNG" : "JPEG" });
    }),
  );
  return out;
}

const COULEURS: Record<SyntheseConformite, [number, number, number]> = {
  conforme: [16, 185, 129],
  a_verifier: [245, 158, 11],
  bloque: [220, 38, 38],
};

/** Dossier de conformité PDF d'un sous-traitant (langue de l'interface) : chargement + PDF. */
export async function dossierConformitePdf(sousTraitantId: string, societe: string) {
  const d = await chargerDossier(sousTraitantId);
  const captures = await chargerCaptures(d);
  const t = i18n.getFixedT(i18n.language, "exports");
  construireDossierPdf(d, captures, societe).save(
    `${nomFichier(`${t("dossierFile")}_${d.st.raison_sociale}_${aujourdhuiBruxelles()}`)}.pdf`,
  );
}

/** Construction du PDF à partir des données déjà chargées (testable avec des données fictives). */
export function construireDossierPdf(
  d: Dossier,
  captures: Map<string, { url: string; format: "JPEG" | "PNG" }>,
  societe: string,
): jsPDF {
  const t = i18n.getFixedT(i18n.language, "exports");
  const ts = i18n.getFixedT(i18n.language, "sousTraitants");
  const statut = (x: string) => ts(`compliance.status.${x as StatutConformite}`);
  const exigence = (x: string) => ts(`compliance.requirement.${x as "iban"}`);
  const st = d.st;
  const jour = aujourdhuiBruxelles();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const tableau = {
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 23, 42] as [number, number, number], textColor: 255 },
    margin: { left: 14, right: 14 },
  };
  const titre = (texte: string, y: number) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(s(texte), 14, y);
    doc.setFont("helvetica", "normal");
    return y + 3;
  };
  const vide = (y: number) => {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s(t("dossier.none")), 14, y + 4);
    doc.setTextColor(15, 23, 42);
    return y + 8;
  };

  // 1. Synthèse
  header(doc, s(t("dossier.title")), s(`${st.raison_sociale} — ${societe}`));
  const synthese = d.ligne ? syntheseConformite(d.ligne) : "a_verifier";
  doc.setFillColor(...COULEURS[synthese]);
  doc.roundedRect(14, 48, 182, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(s(t(`summary.${synthese}`).toUpperCase()), 105, 56, { align: "center" });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(s(t(`dossier.summaryHint.${synthese}`)), 105, 62, { align: "center" });
  doc.setTextColor(15, 23, 42);
  autoTable(doc, {
    ...tableau,
    startY: 72,
    head: [[t("dossier.requirement"), t("dossier.status")].map(s)],
    body: EXIGENCES.map((e) => [exigence(e), statut(d.ligne?.[e] ?? "manquant")].map(s)),
  });
  let y = lastTableY(doc) + 6;
  if (d.ligne?.derogation_jusqua) {
    doc.setFontSize(9);
    doc.text(
      s(t("dossier.derogationUntil", { date: formatDateBE(d.ligne.derogation_jusqua) })),
      14,
      y,
    );
    y += 6;
  }

  // 2. Coordonnées
  y = titre(t("dossier.details"), y + 4);
  autoTable(doc, {
    ...tableau,
    startY: y,
    showHead: false,
    body: [
      [t("dossier.name"), st.raison_sociale],
      [
        t("dossier.legalForm"),
        st.forme_juridique
          ? i18n.t(`statuts:formeJuridique.${st.forme_juridique as "srl"}`, {
              defaultValue: st.forme_juridique,
            })
          : "",
      ],
      [t("cols.bce"), st.numero_bce ? formatBCE(st.numero_bce) : ""],
      [t("dossier.vat"), st.numero_tva ? formatVATDisplay(st.numero_tva) : ""],
      [
        t("dossier.address"),
        [st.adresse, [st.code_postal, st.ville].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", "),
      ],
      [
        t("dossier.contact"),
        [st.contact_nom, st.contact_email ?? st.email, st.contact_telephone ?? st.telephone]
          .filter(Boolean)
          .join(" · "),
      ],
      [
        "IBAN",
        st.iban
          ? `${st.iban} — ${
              st.iban_valide_le
                ? t("dossier.ibanValidated", { date: formatDateBE(st.iban_valide_le) })
                : t("dossier.ibanNotValidated")
            }`
          : "",
      ],
    ].map((r) => r.map(s)),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
  });

  // 3. Attestations
  y = titre(t("dossier.certificates"), lastTableY(doc) + 10);
  if (d.documents.length === 0) y = vide(y);
  else {
    autoTable(doc, {
      ...tableau,
      startY: y,
      head: [
        [
          t("dossier.document"),
          t("dossier.issued"),
          t("dossier.expires"),
          t("dossier.status"),
          t("dossier.file"),
          t("dossier.invalidation"),
        ].map(s),
      ],
      body: d.documents.map((x) =>
        [
          exigence(x.type_document),
          x.date_emission ? formatDateBE(x.date_emission) : "",
          x.date_expiration ? formatDateBE(x.date_expiration) : t("dossier.noExpiry"),
          statut(statutDocument(x.date_expiration, x.invalide_le, jour)),
          x.fichier ? t("yes") : t("no"),
          x.invalide_le ? `${formatDateBE(x.invalide_le)} — ${x.motif_invalidation ?? ""}` : "",
        ].map(s),
      ),
    });
    y = lastTableY(doc);
  }

  // 4. Vérifications 30bis
  y = titre(t("dossier.checks"), y + 10);
  if (d.verifications.length === 0) y = vide(y);
  else {
    autoTable(doc, {
      ...tableau,
      startY: y,
      head: [
        [
          t("cols.checkedAt"),
          t("cols.checkStatus"),
          t("dossier.onssDebt"),
          t("dossier.spfDebt"),
          t("dossier.capture"),
          t("dossier.notes"),
        ].map(s),
      ],
      body: d.verifications.map((v) =>
        [
          dateHeureBruxelles(v.verifie_le),
          t(`checkStatus.${statutVerification(v)}`),
          v.montant_dette_onss != null ? formatEURBE(v.montant_dette_onss) : "",
          v.montant_dette_spf != null ? formatEURBE(v.montant_dette_spf) : "",
          !v.preuve_fichier
            ? t("dossier.captureNone")
            : captures.has(v.id)
              ? t("dossier.captureAnnex")
              : t("dossier.captureInApp"),
          v.notes ?? "",
        ].map(s),
      ),
    });
    y = lastTableY(doc);
  }

  // 5. Contrats
  y = titre(t("dossier.contracts"), y + 10);
  const liens: { ligne: number; url: string }[] = [];
  if (d.contrats.length === 0) y = vide(y);
  else {
    const body = d.contrats.map((c, i) => {
      const sig =
        d.signatures.find((x) => x.contrat_id === c.id && x.statut === "signe") ??
        d.signatures.find((x) => x.contrat_id === c.id);
      const etat = sig ? etatSignature(sig) : null;
      // Lien seulement pour un contrat SIGNÉ : le lien d'un contrat envoyé permettrait de le signer.
      if (sig && etat === "signe") liens.push({ ligne: i, url: lienSignature(sig.token) });
      const ch = c.chantier_id ? d.chantiers.get(c.chantier_id) : undefined;
      return [
        c.descriptif_prestations,
        ch ? `${ch.name}${ch.client_name ? ` (${ch.client_name})` : ""}` : "",
        c.type_prix === "forfait"
          ? formatEURBE(c.montant_forfait_ht)
          : `${formatEURBE(c.prix_unitaire_ht)} / ${c.unite ?? ""}`,
        etat ? i18n.t(`contrats:status.${etat}`) : t("dossier.notSent"),
        sig?.signe_le ? formatDateBE(sig.signe_le) : "",
        sig && etat === "signe" ? t("dossier.openLink") : "",
      ].map(s);
    });
    autoTable(doc, {
      ...tableau,
      startY: y,
      head: [
        [
          t("dossier.contract"),
          t("cols.site"),
          t("dossier.price"),
          t("dossier.signature"),
          t("dossier.signedOn"),
          t("dossier.signedPdf"),
        ].map(s),
      ],
      body,
      didDrawCell: (c) => {
        const l = liens.find((x) => x.ligne === c.row.index);
        if (c.section === "body" && c.column.index === 5 && l) {
          doc.link(c.cell.x, c.cell.y, c.cell.width, c.cell.height, { url: l.url });
        }
      },
      columnStyles: { 5: { textColor: [37, 99, 235] } },
    });
    y = lastTableY(doc);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(s(t("dossier.linkHint")), 182), 14, y + 4);
    doc.setTextColor(15, 23, 42);
    y += 8;
  }

  // 6. Paiements et retenues
  y = titre(t("dossier.payments"), y + 8);
  const valides = d.paiements.filter((p) => !p.annule_le);
  if (d.paiements.length === 0) y = vide(y);
  else {
    const somme = (f: (p: Tables<"achat_paiements">) => number) =>
      valides.reduce((acc, p) => acc + f(p), 0);
    autoTable(doc, {
      ...tableau,
      startY: y,
      head: [
        [
          t("cols.paymentDate"),
          t("cols.invoice"),
          t("cols.exclVat"),
          t("cols.onss"),
          t("cols.spf"),
          t("cols.totalWithheld"),
          t("cols.paid"),
        ].map(s),
      ],
      body: d.paiements.map((p) =>
        [
          formatDateBE(p.date_paiement) + (p.annule_le ? ` (${t("cancelledShort")})` : ""),
          p.reference ?? "",
          formatEURBE(p.montant_ht),
          formatEURBE(p.retenue_onss),
          formatEURBE(p.retenue_spf),
          formatEURBE(Number(p.retenue_onss) + Number(p.retenue_spf)),
          formatEURBE(p.montant_verse),
        ].map(s),
      ),
      foot: [
        [
          s(t("totals", { count: valides.length })),
          "",
          s(formatEURBE(somme((p) => Number(p.montant_ht)))),
          s(formatEURBE(somme((p) => Number(p.retenue_onss)))),
          s(formatEURBE(somme((p) => Number(p.retenue_spf)))),
          s(formatEURBE(somme((p) => Number(p.retenue_onss) + Number(p.retenue_spf)))),
          s(formatEURBE(somme((p) => Number(p.montant_verse ?? 0)))),
        ],
      ],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });
    y = lastTableY(doc);
  }

  // 7. Dérogations
  y = titre(t("dossier.derogations"), y + 10);
  if (d.derogations.length === 0) y = vide(y);
  else {
    autoTable(doc, {
      ...tableau,
      startY: y,
      head: [
        [t("dossier.from"), t("dossier.to"), t("dossier.reason"), t("dossier.revoked")].map(s),
      ],
      body: d.derogations.map((x) =>
        [
          formatDateBE(x.accordee_le),
          formatDateBE(x.expire_le),
          x.motif,
          x.revoquee_le ? formatDateBE(x.revoquee_le) : "",
        ].map(s),
      ),
    });
    y = lastTableY(doc);
  }

  // Annexe : captures
  if (captures.size) {
    doc.addPage();
    let ya = titre(t("dossier.annex"), 20) + 4;
    for (const v of d.verifications) {
      const c = captures.get(v.id);
      if (!c) continue;
      const props = doc.getImageProperties(c.url);
      const largeur = 182;
      const hauteur = Math.min((props.height / props.width) * largeur, 230);
      const l = (hauteur / props.height) * props.width;
      if (ya + hauteur + 10 > 285) {
        doc.addPage();
        ya = 20;
      }
      doc.setFontSize(9);
      doc.text(
        s(
          `${t("dossier.checkOf", { date: dateHeureBruxelles(v.verifie_le) })} — ${t(`checkStatus.${statutVerification(v)}`)}`,
        ),
        14,
        ya,
      );
      doc.addImage(c.url, c.format, 14, ya + 2, l, hauteur);
      ya += hauteur + 10;
    }
    y = ya;
  }

  pied(doc, y);
  return doc;
}
