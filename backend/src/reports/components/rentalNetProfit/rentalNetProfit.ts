import { Op } from "sequelize";
import { Entry } from "src/entries/entry.model";
import { Schet } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";

const round2 = (n: number) => Math.round(n * 100) / 100;

const UNALLOCATED_ID = -1;

export type RentalNetProfitNode = {
  id: number;
  name: string;
  parentId: number | null;
  isFolder: boolean;
  income: number;
  otherIncome93: number;
  cogs: number;
  expense20: number;
  netProfit: number;
  profitability: number;
  children?: RentalNetProfitNode[];
};

export type RentalNetProfitResult = {
  reportType: "RENTAL_NET_PROFIT";
  startDate: number;
  endDate: number;
  totals: {
    income: number;
    otherIncome93: number;
    cogs: number;
    expense20: number;
    netProfit: number;
    profitability: number;
  };
  values: RentalNetProfitNode[];
};

type LeafAcc = {
  id: number;
  income: number;
  otherIncome93: number;
  cogs: number;
};

function profitability(revenue: number, netProfit: number): number {
  if (!revenue) return 0;
  return round2((netProfit / revenue) * 100);
}

function calcNetProfit(
  income: number,
  otherIncome93: number,
  cogs: number,
  expense20: number,
): number {
  return round2(income + otherIncome93 - cogs - expense20);
}

function makeLeaf(
  id: number,
  name: string,
  parentId: number | null,
  income: number,
  otherIncome93: number,
  cogs: number,
  expense20: number,
): RentalNetProfitNode {
  const netProfit = calcNetProfit(income, otherIncome93, cogs, expense20);
  const revenue = round2(income + otherIncome93);
  return {
    id,
    name,
    parentId,
    isFolder: false,
    income: round2(income),
    otherIncome93: round2(otherIncome93),
    cogs: round2(cogs),
    expense20: round2(expense20),
    netProfit,
    profitability: profitability(revenue, netProfit),
  };
}

/** Roll up children into folder nodes by parentId chain. */
function buildTree(
  leaves: RentalNetProfitNode[],
  refsById: Map<number, Reference>,
): RentalNetProfitNode[] {
  const nodeById = new Map<number, RentalNetProfitNode>();

  for (const leaf of leaves) {
    nodeById.set(leaf.id, { ...leaf, children: undefined });
  }

  const ensureFolder = (folderId: number): RentalNetProfitNode => {
    const existing = nodeById.get(folderId);
    if (existing) {
      if (!existing.isFolder) {
        // Leaf id coinciding with folder should not happen; treat as-is.
        return existing;
      }
      return existing;
    }
    const ref = refsById.get(folderId);
    const folder: RentalNetProfitNode = {
      id: folderId,
      name: ref?.name || `#${folderId}`,
      parentId: ref?.parentId ?? null,
      isFolder: true,
      income: 0,
      otherIncome93: 0,
      cogs: 0,
      expense20: 0,
      netProfit: 0,
      profitability: 0,
      children: [],
    };
    nodeById.set(folderId, folder);
    return folder;
  };

  // Attach each leaf to parent chain; create virtual folders as needed.
  for (const leaf of leaves) {
    let childId = leaf.id;
    let parentId = leaf.parentId;
    const visited = new Set<number>([childId]);

    while (parentId != null && parentId > 0) {
      if (visited.has(parentId)) break;
      visited.add(parentId);

      const folder = ensureFolder(parentId);
      if (!folder.children) folder.children = [];
      const child = nodeById.get(childId)!;
      if (!folder.children.some((c) => c.id === child.id)) {
        folder.children.push(child);
      }
      childId = parentId;
      parentId = folder.parentId;
    }
  }

  // Roll up amounts bottom-up
  const rollup = (node: RentalNetProfitNode): void => {
    if (!node.isFolder || !node.children?.length) return;
    for (const ch of node.children) rollup(ch);
    node.income = round2(node.children.reduce((s, c) => s + c.income, 0));
    node.otherIncome93 = round2(
      node.children.reduce((s, c) => s + c.otherIncome93, 0),
    );
    node.cogs = round2(node.children.reduce((s, c) => s + c.cogs, 0));
    node.expense20 = round2(
      node.children.reduce((s, c) => s + c.expense20, 0),
    );
    node.netProfit = calcNetProfit(
      node.income,
      node.otherIncome93,
      node.cogs,
      node.expense20,
    );
    node.profitability = profitability(
      node.income + node.otherIncome93,
      node.netProfit,
    );
    node.children.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "uz"),
    );
  };

  const roots: RentalNetProfitNode[] = [];
  const rootIds = new Set<number>();

  for (const node of Array.from(nodeById.values())) {
    const pid = node.parentId;
    const hasParentInTree =
      pid != null && pid > 0 && nodeById.has(pid) && nodeById.get(pid)!.isFolder;
    if (!hasParentInTree) {
      // Only include as root if not already nested under another root's children
      if (!rootIds.has(node.id)) {
        // Skip leaves that are children of folders we created
        let isNested = false;
        for (const other of Array.from(nodeById.values())) {
          if (
            other.isFolder &&
            other.children?.some((c) => c.id === node.id)
          ) {
            isNested = true;
            break;
          }
        }
        if (!isNested) {
          roots.push(node);
          rootIds.add(node.id);
        }
      }
    }
  }

  for (const r of roots) rollup(r);
  roots.sort((a, b) => (a.name || "").localeCompare(b.name || "", "uz"));
  return roots;
}

export async function rentalNetProfit(
  startDate: number,
  endDate: number,
  enterpriseId: number | null | undefined,
  entryRepository: typeof Entry,
): Promise<RentalNetProfitResult> {
  const empty: RentalNetProfitResult = {
    reportType: "RENTAL_NET_PROFIT",
    startDate,
    endDate,
    totals: {
      income: 0,
      otherIncome93: 0,
      cogs: 0,
      expense20: 0,
      netProfit: 0,
      profitability: 0,
    },
    values: [],
  };

  if (!startDate || !endDate) return empty;

  // Fallback literals: hot-reload can leave Schet without S93 in require cache
  const S40 = Schet.S40 ?? ("S40" as Schet);
  const S90 = Schet.S90 ?? ("S90" as Schet);
  const S91 = Schet.S91 ?? ("S91" as Schet);
  const S93 = Schet.S93 ?? ("S93" as Schet);
  const S20 = Schet.S20 ?? ("S20" as Schet);

  const entWhere =
    enterpriseId != null && enterpriseId !== undefined
      ? { enterpriseId }
      : {};

  const dateWhere = {
    date: { [Op.gte]: startDate, [Op.lte]: endDate },
  };

  const [incomeEntries, otherIncome93Entries, cogsEntries, expense20Entries] =
    await Promise.all([
      entryRepository.findAll({
        where: {
          ...dateWhere,
          ...entWhere,
          kredit: S90,
        },
        attributes: ["kreditSecondSubcontoId", "total"],
      }),
      entryRepository.findAll({
        where: {
          ...dateWhere,
          ...entWhere,
          debet: S40,
          kredit: S93,
        },
        attributes: ["kreditSecondSubcontoId", "total"],
      }),
      entryRepository.findAll({
        where: {
          ...dateWhere,
          ...entWhere,
          debet: S91,
        },
        attributes: ["debetSecondSubcontoId", "total"],
      }),
      entryRepository.findAll({
        where: {
          ...dateWhere,
          ...entWhere,
          debet: S20,
        },
        attributes: ["total"],
      }),
    ]);

  const byTmz = new Map<number, LeafAcc>();

  const bump = (
    tmzId: number | null | undefined,
    field: "income" | "otherIncome93" | "cogs",
    amount: number,
  ) => {
    const id =
      tmzId != null && Number(tmzId) > 0 ? Number(tmzId) : UNALLOCATED_ID;
    const cur = byTmz.get(id) || {
      id,
      income: 0,
      otherIncome93: 0,
      cogs: 0,
    };
    cur[field] += amount;
    byTmz.set(id, cur);
  };

  for (const e of incomeEntries) {
    bump(e.kreditSecondSubcontoId, "income", Number(e.total) || 0);
  }
  for (const e of otherIncome93Entries) {
    bump(e.kreditSecondSubcontoId, "otherIncome93", Number(e.total) || 0);
  }
  for (const e of cogsEntries) {
    bump(e.debetSecondSubcontoId, "cogs", Number(e.total) || 0);
  }

  const totalExpense20 = round2(
    expense20Entries.reduce((s, e) => s + (Number(e.total) || 0), 0),
  );

  const tmzIds = Array.from(byTmz.keys()).filter((id) => id !== UNALLOCATED_ID);
  const refs =
    tmzIds.length > 0
      ? await Reference.findAll({
          where: { id: { [Op.in]: tmzIds } },
          include: [{ model: RefValues, required: false }],
        })
      : [];

  const refsById = new Map<number, Reference>();
  for (const r of refs) refsById.set(Number(r.id), r);

  // Load ancestor folders not in leaf set
  const neededFolderIds = new Set<number>();
  for (const r of refs) {
    let pid = r.parentId ?? null;
    while (pid != null && pid > 0 && !neededFolderIds.has(pid)) {
      neededFolderIds.add(pid);
      const already = refsById.get(pid);
      if (already) {
        pid = already.parentId ?? null;
      } else {
        break;
      }
    }
  }
  const missingFolderIds = Array.from(neededFolderIds).filter(
    (id) => !refsById.has(id),
  );
  if (missingFolderIds.length) {
    const folders = await Reference.findAll({
      where: { id: { [Op.in]: missingFolderIds } },
    });
    for (const f of folders) refsById.set(Number(f.id), f);

    // Walk further ancestors iteratively
    let more = true;
    while (more) {
      more = false;
      const extra: number[] = [];
      for (const id of Array.from(refsById.keys())) {
        const ref = refsById.get(id)!;
        const pid = ref.parentId ?? null;
        if (pid != null && pid > 0 && !refsById.has(pid)) {
          extra.push(pid);
        }
      }
      if (extra.length) {
        more = true;
        const moreRefs = await Reference.findAll({
          where: { id: { [Op.in]: extra } },
        });
        for (const f of moreRefs) refsById.set(Number(f.id), f);
      }
    }
  }

  // Distribute S20 by income share only among leaves WITHOUT cogs (S91).
  // Rows with себестоимость already bear direct cost — do not load S20 onto them.
  const leafEntries = Array.from(byTmz.values()).filter(
    (v) => v.income > 0 || v.otherIncome93 > 0 || v.cogs > 0,
  );
  leafEntries.sort((a, b) => a.id - b.id);

  const allocBaseLeaves = leafEntries.filter(
    (v) => v.income > 0 && v.cogs <= 0,
  );
  const incomeWithCogsLeaves = leafEntries.filter(
    (v) => v.income > 0 && v.cogs > 0,
  );
  const otherOnlyLeaves = leafEntries.filter(
    (v) => v.income <= 0 && v.otherIncome93 > 0 && v.cogs <= 0,
  );
  const cogsOnlyLeaves = leafEntries.filter(
    (v) => v.income <= 0 && v.otherIncome93 <= 0 && v.cogs > 0,
  );
  const otherWithCogsLeaves = leafEntries.filter(
    (v) => v.income <= 0 && v.otherIncome93 > 0 && v.cogs > 0,
  );

  const allocBaseIncome = round2(
    allocBaseLeaves.reduce((s, v) => s + v.income, 0),
  );

  let allocatedExpense = 0;
  const leaves: RentalNetProfitNode[] = [];

  const pushLeaf = (leaf: LeafAcc, expense20: number) => {
    if (leaf.id === UNALLOCATED_ID) {
      leaves.push(
        makeLeaf(
          UNALLOCATED_ID,
          "Аналитикасиз",
          null,
          leaf.income,
          leaf.otherIncome93,
          leaf.cogs,
          expense20,
        ),
      );
      return;
    }
    const ref = refsById.get(leaf.id);
    leaves.push(
      makeLeaf(
        leaf.id,
        ref?.name || `#${leaf.id}`,
        ref?.parentId ?? null,
        leaf.income,
        leaf.otherIncome93,
        leaf.cogs,
        expense20,
      ),
    );
  };

  for (let i = 0; i < allocBaseLeaves.length; i++) {
    const leaf = allocBaseLeaves[i];
    let expense20 = 0;
    if (allocBaseIncome > 0 && totalExpense20 > 0) {
      if (i === allocBaseLeaves.length - 1) {
        expense20 = round2(totalExpense20 - allocatedExpense);
      } else {
        expense20 = round2((totalExpense20 * leaf.income) / allocBaseIncome);
        allocatedExpense = round2(allocatedExpense + expense20);
      }
    }
    pushLeaf(leaf, expense20);
  }

  for (const leaf of incomeWithCogsLeaves) {
    pushLeaf(leaf, 0);
  }

  for (const leaf of otherWithCogsLeaves) {
    pushLeaf(leaf, 0);
  }

  for (const leaf of otherOnlyLeaves) {
    pushLeaf(leaf, 0);
  }

  for (const leaf of cogsOnlyLeaves) {
    pushLeaf(leaf, 0);
  }

  // Если базы для 20 нет (все доходы с 91), а Дт 20 есть — «Аналитикасиз»
  if (allocBaseIncome <= 0 && totalExpense20 > 0) {
    const existingUnalloc = leaves.find((l) => l.id === UNALLOCATED_ID);
    if (existingUnalloc) {
      existingUnalloc.expense20 = round2(
        existingUnalloc.expense20 + totalExpense20,
      );
      existingUnalloc.netProfit = calcNetProfit(
        existingUnalloc.income,
        existingUnalloc.otherIncome93,
        existingUnalloc.cogs,
        existingUnalloc.expense20,
      );
      existingUnalloc.profitability = profitability(
        existingUnalloc.income + existingUnalloc.otherIncome93,
        existingUnalloc.netProfit,
      );
    } else {
      pushLeaf(
        { id: UNALLOCATED_ID, income: 0, otherIncome93: 0, cogs: 0 },
        totalExpense20,
      );
    }
  }

  const tree = buildTree(
    leaves.filter((l) => l.id !== UNALLOCATED_ID),
    refsById,
  );
  const unallocated = leaves.find((l) => l.id === UNALLOCATED_ID);
  const values = unallocated ? [...tree, unallocated] : tree;

  const totalsIncome = round2(leaves.reduce((s, l) => s + l.income, 0));
  const totalsOther93 = round2(
    leaves.reduce((s, l) => s + l.otherIncome93, 0),
  );
  const totalsCogs = round2(leaves.reduce((s, l) => s + l.cogs, 0));
  const totalsExp = round2(leaves.reduce((s, l) => s + l.expense20, 0));
  const totalsNet = calcNetProfit(
    totalsIncome,
    totalsOther93,
    totalsCogs,
    totalsExp,
  );

  return {
    reportType: "RENTAL_NET_PROFIT",
    startDate,
    endDate,
    totals: {
      income: totalsIncome,
      otherIncome93: totalsOther93,
      cogs: totalsCogs,
      expense20: totalsExp,
      netProfit: totalsNet,
      profitability: profitability(totalsIncome + totalsOther93, totalsNet),
    },
    values,
  };
}
