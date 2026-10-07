import axios from 'axios';
import { getDataForSwr } from '../common/getDataForSwr';

export const getEnterprises = async (token: string | undefined) => {
  const url = process.env.NEXT_PUBLIC_DOMAIN + '/api/enterprises/';
  return getDataForSwr(url, token);
};

