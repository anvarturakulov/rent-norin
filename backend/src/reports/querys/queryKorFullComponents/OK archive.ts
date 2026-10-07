// import { Schet, TypeQuery } from "src/interfaces/report.interface";

// export const OK = async (
//     debet: Schet,
//     kredit: Schet,
//     typeQuery: TypeQuery,
//     startDate: number | null,
//     endDate: number | null,
//     debetFirstSubcontoId: number | undefined | null,
//     debetSecondSubcontoId: number | undefined | null,
//     debetThirdSubcontoId: number | undefined | null,
//     kreditFirstSubcontoId: number | undefined | null,
//     kreditSecondSubcontoId: number | undefined | null,
//     kreditThirdSubcontoId: number | undefined | null,
// ) => {

//     const replacements: { [key: string]: any } = {};

//     let query = ` SELECT SUM(count) as total
//                   FROM entries
//                   WHERE `

//     if (debet !== null && debet !== undefined) {
//         query += ` debet = :debet`;
//         replacements.debet = debet;
//     }

//     if (kredit !== null && kredit !== undefined) {
//         query += ` AND kredit = :kredit`;
//         replacements.kredit = kredit;
//     }

//     if (startDate !== null && startDate !== undefined) {
//         query += ` AND date >= :startDate`;
//         replacements.startDate = startDate;
//     }

//     if (endDate !== null && endDate !== undefined) {
//         query += ` AND date <= :endDate`;
//         replacements.endDate = endDate;
//     }

//     if (debetFirstSubcontoId !== null && debetFirstSubcontoId !== undefined) {
//         query += ` AND "debetFirstSubcontoId" = :debetFirstSubcontoId`;
//         replacements.debetFirstSubcontoId = debetFirstSubcontoId;
//     }

//     if (debetSecondSubcontoId !== null && debetSecondSubcontoId !== undefined) {
//         query += ` AND "debetSecondSubcontoId" = :debetSecondSubcontoId`;
//         replacements.debetSecondSubcontoId = debetSecondSubcontoId;
//     }

//     if (debetThirdSubcontoId !== null && debetThirdSubcontoId !== undefined) {
//         query += ` AND "debetThirdSubcontoId" = :debetThirdSubcontoId`;
//         replacements.debetThirdSubcontoId = debetThirdSubcontoId;
//     }

//     if (kreditFirstSubcontoId !== null && kreditFirstSubcontoId !== undefined) {
//         query += ` AND "kreditFirstSubcontoId" = :kreditFirstSubcontoId`;
//         replacements.kreditFirstSubcontoId = kreditFirstSubcontoId;
//     }

//     if (kreditSecondSubcontoId !== null && kreditSecondSubcontoId !== undefined) {
//         query += ` AND "kreditSecondSubcontoId" = :kreditSecondSubcontoId`;
//         replacements.kreditSecondSubcontoId = kreditSecondSubcontoId;
//     }

//     if (kreditThirdSubcontoId !== null && kreditThirdSubcontoId !== undefined) {
//         query += ` AND "kreditThirdSubcontoId" = :kreditThirdSubcontoId`;
//         replacements.kreditThirdSubcontoId = kreditThirdSubcontoId;
//     }

//     let stopQuery = (!debet || !kredit || !startDate || !endDate) ? true : false

//     return {query, replacements, stopQuery}
// }
