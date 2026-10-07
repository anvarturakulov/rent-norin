import { ReferenceModel, TypeSECTION } from '@/app/interfaces/reference.interface';
import { getPereodicById } from '@/app/service/references/getPereodicById';

export const getPereodic = async (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
): Promise<void> => {
  try {
    if (!id || !setMainData || !token) {
      console.warn('getPereodic: Missing required parameters', { id, setMainData: !!setMainData, token: !!token });
      return;
    }

    await getPereodicById(id, setMainData, token);
    setMainData('isNewPereodic', false);
  } catch (error) {
    console.error('Error in getPereodic:', error);
  }
}






