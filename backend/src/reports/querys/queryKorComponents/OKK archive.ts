// import { Schet, TypeQuery } from "src/interfaces/report.interface";

// export const OKK = (
//     debet: Schet,
//     kredit: Schet,
//     typeQuery: TypeQuery,
//     startDate: number | null,
//     endDate: number | null,
//     firstSubcontoId: number | undefined | null,
//     secondSubcontoId: number | undefined | null,
//     thirdSubcontoId: number | undefined | null,
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

//     if (firstSubcontoId !== null && firstSubcontoId !== undefined) {
//         query += ` AND "kreditFirstSubcontoId" = :firstSubcontoId`;
//         replacements.firstSubcontoId = firstSubcontoId;
//     }

//     if (secondSubcontoId !== null && secondSubcontoId !== undefined) {
//         query += ` AND "kreditSecondSubcontoId" = :secondSubcontoId`;
//         replacements.secondSubcontoId = secondSubcontoId;
//     }

//     if (thirdSubcontoId !== null && thirdSubcontoId !== undefined) {
//         query += ` AND "kreditThirdSubcontoId" = :thirdSubcontoId`;
//         replacements.thirdSubcontoId = thirdSubcontoId;
//     }

//     let stopQuery = (!debet || !kredit || !startDate || !endDate) ? true : false

//     return {query, replacements, stopQuery}
// }
