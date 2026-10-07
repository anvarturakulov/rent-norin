import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Reference } from "src/references/reference.model";
import { SubleaseToolOpenBatch } from "src/subleaseToolBatches/subleaseToolOpenBatch.model";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type SubleasePartnerMarginRow = {
  partnerId: number;
  partnerName: string;
  clientRent: number;
  partnerCost: number;
  margin: number;
  marginPct: number;
  openQty: number;
};

export type SubleasePartnerMarginResult = {
  reportType: "SubleasePartnerMargin";
  startDate: number;
  endDate: number;
  totals: {
    clientRent: number;
    partnerCost: number;
    margin: number;
    marginPct: number;
    openQty: number;
  };
  values: {
    rows: SubleasePartnerMarginRow[];
  };
};

export const subleasePartnerMargin = async (
  startDate: number,
  endDate: number,
  enterpriseId: number | null | undefined,
  partnerIdFilter?: number | null,
): Promise<SubleasePartnerMarginResult> => {
  const docWhere: Record<string, unknown> = {
    documentType: DocumentType.ReceiveSubleaseToolsFromClient,
    docStatus: DocSTATUS.PROVEDEN,
    date: { [Op.between]: [startDate, endDate] },
  };
  if (enterpriseId != null && Number(enterpriseId) > 0) {
    docWhere.enterpriseId = Number(enterpriseId);
  }

  const docs = await Document.findAll({
    where: docWhere,
    include: [
      { model: DocValues, required: false },
      { model: DocTableItems, required: false },
    ],
  });

  const byPartner = new Map<
    number,
    { clientRent: number; partnerCost: number }
  >();

  for (const doc of docs) {
    const partnerId = Number(doc.docValues?.partnerId) || 0;
    if (!partnerId) continue;
    if (partnerIdFilter && partnerId !== Number(partnerIdFilter)) continue;

    let clientRent = 0;
    let partnerCost = 0;
    for (const row of doc.docTableItems || []) {
      if ((row.tableType || "return") !== "return") continue;
      const rentSum = Number(row.rentSum) || 0;
      const discount = Number(row.price) || 0;
      clientRent += Math.max(0, rentSum - discount);
      partnerCost += Number(row.partnerRentSum) || 0;
    }

    const prev = byPartner.get(partnerId) || { clientRent: 0, partnerCost: 0 };
    byPartner.set(partnerId, {
      clientRent: prev.clientRent + clientRent,
      partnerCost: prev.partnerCost + partnerCost,
    });
  }

  const openWhere: Record<string, unknown> = {
    openQty: { [Op.gt]: 0 },
  };
  if (enterpriseId != null && Number(enterpriseId) > 0) {
    openWhere.enterpriseId = Number(enterpriseId);
  }
  if (partnerIdFilter && Number(partnerIdFilter) > 0) {
    openWhere.partnerId = Number(partnerIdFilter);
  }

  const openBatches = await SubleaseToolOpenBatch.findAll({ where: openWhere });
  const openByPartner = new Map<number, number>();
  for (const batch of openBatches) {
    const pid = Number(batch.partnerId);
    openByPartner.set(
      pid,
      (openByPartner.get(pid) || 0) + Number(batch.openQty),
    );
    if (!byPartner.has(pid)) {
      byPartner.set(pid, { clientRent: 0, partnerCost: 0 });
    }
  }

  const partnerIds = [...byPartner.keys()];
  const partners = partnerIds.length
    ? await Reference.findAll({ where: { id: { [Op.in]: partnerIds } } })
    : [];
  const nameById = new Map(partners.map((p) => [Number(p.id), p.name || `#${p.id}`]));

  const rows: SubleasePartnerMarginRow[] = partnerIds
    .map((partnerId) => {
      const agg = byPartner.get(partnerId)!;
      const clientRent = round2(agg.clientRent);
      const partnerCost = round2(agg.partnerCost);
      const margin = round2(clientRent - partnerCost);
      const marginPct = clientRent > 0 ? round2((margin / clientRent) * 100) : 0;
      return {
        partnerId,
        partnerName: nameById.get(partnerId) || `#${partnerId}`,
        clientRent,
        partnerCost,
        margin,
        marginPct,
        openQty: round2(openByPartner.get(partnerId) || 0),
      };
    })
    .sort((a, b) => a.partnerName.localeCompare(b.partnerName, "ru"));

  const totalsClientRent = round2(rows.reduce((s, r) => s + r.clientRent, 0));
  const totalsPartnerCost = round2(rows.reduce((s, r) => s + r.partnerCost, 0));
  const totalsMargin = round2(totalsClientRent - totalsPartnerCost);
  const totalsOpenQty = round2(rows.reduce((s, r) => s + r.openQty, 0));

  return {
    reportType: "SubleasePartnerMargin",
    startDate,
    endDate,
    totals: {
      clientRent: totalsClientRent,
      partnerCost: totalsPartnerCost,
      margin: totalsMargin,
      marginPct:
        totalsClientRent > 0
          ? round2((totalsMargin / totalsClientRent) * 100)
          : 0,
      openQty: totalsOpenQty,
    },
    values: { rows },
  };
};
