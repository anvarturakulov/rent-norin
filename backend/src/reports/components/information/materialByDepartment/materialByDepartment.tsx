import { Schet } from 'src/interfaces/report.interface';
import { OborotsService } from 'src/oborots/oborots.service';
import { Reference } from 'src/references/reference.model';
import { TypeReference, TypeSECTION, TypeTMZ } from 'src/interfaces/reference.interface';

interface MaterialByDepartmentItem {
    departmentId: number;
    departmentName: string;
    materials: Array<{
        materialId: number;
        materialName: string;
        count: number;
        summa: number;
    }>;
    totalCount: number;
    totalSumma: number;
}

export const materialByDepartment = async (
    data: Reference[],
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    enterpriseId?: number | null
): Promise<{ reportType: string; values: MaterialByDepartmentItem[] }> => {
    const result: MaterialByDepartmentItem[] = [];

    if (!data || !startDate || !endDate) {
        return { reportType: 'MATERIALBYDEPARTMENT', values: [] };
    }

    // Получаем подразделения (цеха) - STORAGES с типом PRODUCTION
    const departments = data.filter(
        (item: Reference) => 
            item?.typeReference === TypeReference.STORAGES && 
            item?.refValues?.typeSection === TypeSECTION.PRODUCTION &&
            !item.refValues?.markToDeleted &&
            item.id
    );

    // Фильтрация по enterpriseId для отчетов одного предприятия
    // Для ADMINGLOBAL (enterpriseId === null/undefined) показываем все подразделения
    const filteredDepartments = departments.filter((item: Reference) => {
        if (!item.refValues) return false;
        // Для глобальных отчетов (ADMINGLOBAL) показываем все storages
        if (enterpriseId === null || enterpriseId === undefined) {
            return true;
        }
        return item.enterpriseId === enterpriseId || item.enterpriseId === null;
    });

    // Получаем все материалы (TMZ с типом MATERIAL)
    const materials = data.filter(
        (item: Reference) => 
            item?.typeReference === TypeReference.TMZ &&
            item?.refValues?.typeTMZ === TypeTMZ.MATERIAL &&
            !item.refValues?.markToDeleted &&
            item.id
    );
    
    if (filteredDepartments.length === 0) {
        return { reportType: 'MATERIALBYDEPARTMENT', values: [] };
    }
    
    if (materials.length === 0) {
        return { reportType: 'MATERIALBYDEPARTMENT', values: [] };
    }

    // Для каждого подразделения собираем данные по материалам
    for (const dept of filteredDepartments) {
        if (!dept.id) continue;

        const deptMaterials: Array<{
            materialId: number;
            materialName: string;
            count: number;
            summa: number;
        }> = [];

        let totalCount = 0;
        let totalSumma = 0;

        // Для каждого материала получаем расход по подразделению
        for (const material of materials) {
            if (!material.id) continue;

            // Получаем расход материала по подразделению
            // S20 (основное производство) дебет, S10 (материалы) кредит
            // Подразделение в дебете (debetFirstSubcontoId), материал в кредите (kreditSecondSubcontoId)
            const count20Result = await oborotsService.getOborotByDate(
                'COUNT',
                startDate,
                endDate,
                Schet.S20,
                dept.id, // debetFirstSubcontoId - подразделение в дебете
                null,
                null,
                Schet.S10,
                null,
                material.id, // kreditSecondSubcontoId - материал в кредите
                null,
                undefined,
                enterpriseId
            );
            const count20 = count20Result.result || 0;

            const summa20Result = await oborotsService.getOborotByDate(
                'TOTAL',
                startDate,
                endDate,
                Schet.S20,
                dept.id, // debetFirstSubcontoId - подразделение в дебете
                null,
                null,
                Schet.S10,
                null,
                material.id, // kreditSecondSubcontoId - материал в кредите
                null,
                undefined,
                enterpriseId
            );
            const summa20 = summa20Result.result || 0;

            // S23 (вспомогательное производство) дебет, S10 кредит
            const count23Result = await oborotsService.getOborotByDate(
                'COUNT',
                startDate,
                endDate,
                Schet.S23,
                dept.id, // debetFirstSubcontoId - подразделение в дебете
                null,
                null,
                Schet.S10,
                null,
                material.id, // kreditSecondSubcontoId - материал в кредите
                null,
                undefined,
                enterpriseId
            );
            const count23 = count23Result.result || 0;

            const summa23Result = await oborotsService.getOborotByDate(
                'TOTAL',
                startDate,
                endDate,
                Schet.S23,
                dept.id, // debetFirstSubcontoId - подразделение в дебете
                null,
                null,
                Schet.S10,
                null,
                material.id, // kreditSecondSubcontoId - материал в кредите
                null,
                undefined,
                enterpriseId
            );
            const summa23 = summa23Result.result || 0;

            const count = (count20 || 0) + (count23 || 0);
            const summa = (summa20 || 0) + (summa23 || 0);

            if (count > 0 || summa > 0) {
                deptMaterials.push({
                    materialId: material.id,
                    materialName: material.name || '',
                    count,
                    summa
                });
                totalCount += count;
                totalSumma += summa;
            }
        }

        if (deptMaterials.length > 0) {
            result.push({
                departmentId: dept.id,
                departmentName: dept.name || '',
                materials: deptMaterials,
                totalCount,
                totalSumma
            });
        }
    }

    // Сортировка по сумме (по убыванию)
    result.sort((a, b) => b.totalSumma - a.totalSumma);

    return {
        reportType: 'MATERIALBYDEPARTMENT',
        values: result
    };
};

