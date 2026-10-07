import axios from 'axios';
import { getDataForSwr } from '../common/getDataForSwr';

export const getEnterpriseById = async (
  id: number,
  token: string | undefined
) => {
  const url = process.env.NEXT_PUBLIC_DOMAIN + '/api/enterprises/' + id;
  return getDataForSwr(url, token);
};

