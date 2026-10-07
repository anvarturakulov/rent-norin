export type SingleEnterpriseModeResponse = {
  singleEnterpriseMode: boolean;
  avtoProvodkaInManyEnterpriseMode?: boolean;
};

export const getSingleEnterpriseMode = async (
  token: string | undefined
): Promise<SingleEnterpriseModeResponse> => {
  const defaults: SingleEnterpriseModeResponse = {
    singleEnterpriseMode: false,
    avtoProvodkaInManyEnterpriseMode: false,
  };
  try {
    const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/single-enterprise-mode`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = (await response.json()) as Partial<SingleEnterpriseModeResponse>;
      return {
        singleEnterpriseMode: Boolean(data.singleEnterpriseMode),
        avtoProvodkaInManyEnterpriseMode: Boolean(
          data.avtoProvodkaInManyEnterpriseMode
        ),
      };
    }

    console.warn(
      '[getSingleEnterpriseMode] API returned non-OK status; defaulting to singleEnterpriseMode=false. UI may send wrong docStatus until fixed.',
      response.status,
      response.statusText
    );
    return defaults;
  } catch (e) {
    console.warn(
      '[getSingleEnterpriseMode] Request failed; defaulting to singleEnterpriseMode=false. Documents may be created as PENDING until the settings endpoint works.',
      e
    );
    return defaults;
  }
};
