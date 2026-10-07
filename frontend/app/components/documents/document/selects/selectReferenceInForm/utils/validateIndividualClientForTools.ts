import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { validateUzPassportFields } from '@/app/components/reference/helpers/uzPassport.validation';
import { validateUzJshshirFields } from '@/app/components/reference/helpers/uzJshshir.validation';
import { rentalContractsApi } from '@/app/service/rentalContracts/rentalContracts.service';

export async function validateIndividualClientForTools(
  partner: ReferenceModel | null | undefined,
  token: string | undefined,
  asOf: number,
): Promise<string[]> {
  const rv = partner?.refValues;
  if (!rv || rv.isLegalEntity) return [];

  const errors: string[] = [];
  const individualLike = { ...rv, isIndividualPerson: true };

  if (validateUzPassportFields(individualLike) !== null) {
    errors.push('Паспорт маълумотлари тўлиқ киритилмаган');
  }

  if (validateUzJshshirFields(individualLike) !== null) {
    errors.push('ЖШШИР кўрсатилмаган');
  }

  if (!(rv.address ?? '').trim()) {
    errors.push('Манзил кўрсатилмаган');
  }

  const hasPhone =
    Boolean((rv.phone ?? '').trim()) || Boolean((rv.phone2 ?? '').trim());
  if (!hasPhone) {
    errors.push('Телефон рақами кўрсатилмаган');
  }

  const clientId = Number(partner?.id) || 0;
  if (token && clientId > 0) {
    try {
      const activeContract = await rentalContractsApi.getActiveByClient(
        token,
        clientId,
        asOf,
      );
      if (!activeContract) {
        errors.push('Мижоз билан шартнома топилмади');
      }
    } catch {
      errors.push('Мижоз билан шартнома топилмади');
    }
  } else {
    errors.push('Мижоз билан шартнома топилмади');
  }

  return errors;
}
