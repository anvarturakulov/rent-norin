import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

// Используем NEXT_PUBLIC_DOMAIN для единообразия с остальным кодом

export interface ReferenceUsageInReference {
  referenceId: number;
  name: string;
  article?: string | null;
  typeReference: string;
  field: string;
}

export interface ReferenceUsageInDocument {
  documentId: number;
  documentType?: string | null;
  date?: number | null;
  field: string;
}

export interface ReferenceUsageInRelated {
  source: string;
  id: number;
  label: string;
  field: string;
}

export interface ReferenceUsageResponse {
  referenceId: number;
  inReferences: ReferenceUsageInReference[];
  inDocuments: ReferenceUsageInDocument[];
  inRelated?: ReferenceUsageInRelated[];
  counts: {
    inReferences: number;
    inDocuments: number;
    inRelated?: number;
    total: number;
  };
  canDelete: boolean;
}

export class ReferencesService {
  private static getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Получить все справочники
   */
  static async getAllReferences(token: string): Promise<ReferenceModel[]> {
    try {
      const response = await fetch(withApiDomain('/api/references/all'), {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching all references:', error);
      throw error;
    }
  }

  /**
   * Получить справочники по типу
   */
  static async getReferencesByType(typeReference: string, token: string, enterpriseId?: number | null): Promise<ReferenceModel[]> {
    try {
      const url = enterpriseId 
        ? withApiDomain(`/api/references/byType/${typeReference}?enterpriseId=${enterpriseId}`)
        : withApiDomain(`/api/references/byType/${typeReference}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching references by type:', error);
      throw error;
    }
  }

  /**
   * Получить справочник по ID
   */
  static async getReferenceById(id: number, token: string): Promise<ReferenceModel> {
    try {
      const response = await fetch(withApiDomain(`/api/references/${id}`), {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reference by id:', error);
      throw error;
    }
  }

  /**
   * Создать новый справочник
   */
  static async createReference(data: any, token: string): Promise<ReferenceModel> {
    try {
      const response = await fetch(withApiDomain('/api/references/create'), {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating reference:', error);
      throw error;
    }
  }

  /**
   * Обновить справочник
   */
  static async updateReference(id: number, data: any, token: string): Promise<ReferenceModel> {
    try {
      const response = await fetch(withApiDomain(`/api/references/${id}`), {
        method: 'PATCH',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = text || `HTTP error! status: ${response.status}`;
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(j.message)) message = j.message.join('; ');
          else if (typeof j.message === 'string') message = j.message;
        } catch {
          /* use text */
        }
        throw new Error(message);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating reference:', error);
      throw error;
    }
  }

  /**
   * Следующий артикул TMZ по двухбуквенному префиксу (заполнение «дыр» + max+1).
   */
  static async previewNextTmzArticle(
    token: string,
    prefix: string,
    enterpriseId?: number | null,
    excludeId?: number,
  ): Promise<{ article: string }> {
    const params = new URLSearchParams({ prefix });
    if (enterpriseId != null && enterpriseId !== undefined) {
      params.set('enterpriseId', String(enterpriseId));
    }
    if (excludeId != null && excludeId !== undefined) {
      params.set('excludeId', String(excludeId));
    }
    const response = await fetch(
      withApiDomain(`/api/references/tmz/next-article?${params.toString()}`),
      {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text || `HTTP error! status: ${response.status}`;
      try {
        const j = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(j.message)) message = j.message.join('; ');
        else if (typeof j.message === 'string') message = j.message;
      } catch {
        /* use text */
      }
      throw new Error(message);
    }

    return await response.json();
  }

  /**
   * Следующий артикул WORKS по группе G006 (заполнение «дыр» + max+1).
   */
  static async previewNextWorksArticle(
    token: string,
    prefix: string,
    enterpriseId?: number | null,
    excludeId?: number,
  ): Promise<{ article: string }> {
    const params = new URLSearchParams({ prefix });
    if (enterpriseId != null && enterpriseId !== undefined) {
      params.set('enterpriseId', String(enterpriseId));
    }
    if (excludeId != null && excludeId !== undefined) {
      params.set('excludeId', String(excludeId));
    }
    const response = await fetch(
      withApiDomain(`/api/references/works/next-article?${params.toString()}`),
      {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text || `HTTP error! status: ${response.status}`;
      try {
        const j = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(j.message)) message = j.message.join('; ');
        else if (typeof j.message === 'string') message = j.message;
      } catch {
        /* use text */
      }
      throw new Error(message);
    }

    return await response.json();
  }

  /**
   * Дублировать справочник (копия карточки и норм готовой продукции).
   * Дубликат создаётся сразу в БД и возвращается с refValues.
   */
  static async duplicateReference(id: number, token: string): Promise<ReferenceModel> {
    const response = await fetch(withApiDomain(`/api/references/${id}/duplicate`), {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(token),
        ...getNgrokBypassHeaders(),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text || `HTTP error! status: ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(parsed.message)) message = parsed.message.join('; ');
        else if (typeof parsed.message === 'string') message = parsed.message;
      } catch {
        // leave raw text
      }
      throw new Error(message);
    }

    return await response.json();
  }

  /**
   * Пометить справочник на удаление
   */
  static async markToDelete(id: number, token: string): Promise<ReferenceModel> {
    try {
      const response = await fetch(withApiDomain(`/api/references/markToDelete/${id}`), {
        method: 'DELETE',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking reference for deletion:', error);
      throw error;
    }
  }

  /** Полностью удалить из БД партнёров с importedFromXlsx (+ их договоры аренды) */
  static async deleteImportedPermanent(
    token: string,
  ): Promise<{
    deletedPartners: number;
    deletedContracts: number;
    skipped: number;
    total: number;
    errors: string[];
  }> {
    const response = await fetch(
      withApiDomain('/api/references/delete-imported-permanent'),
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      },
    );
    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body?.message === 'string') message = body.message;
        else if (Array.isArray(body?.message)) message = body.message.join(', ');
      } catch {
        // keep default
      }
      throw new Error(message);
    }
    return response.json();
  }

  /**
   * Получить вхождения справочника
   */
  static async getReferenceUsage(
    id: number,
    token: string,
  ): Promise<ReferenceUsageResponse> {
    try {
      const response = await fetch(withApiDomain(`/api/references/${id}/usage`), {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reference usage:', error);
      throw error;
    }
  }

  /**
   * Полное удаление справочника при отсутствии связей
   */
  static async deleteReferencePermanent(id: number, token: string): Promise<{ success: boolean; id: number }> {
    try {
      const response = await fetch(withApiDomain(`/api/references/${id}/permanent`), {
        method: 'DELETE',
        headers: {
          ...this.getAuthHeaders(token),
          ...getNgrokBypassHeaders(),
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = text || `HTTP error! status: ${response.status}`;
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(parsed.message)) message = parsed.message.join('; ');
          else if (typeof parsed.message === 'string') message = parsed.message;
        } catch {
          // leave raw text
        }
        throw new Error(message);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting reference permanently:', error);
      throw error;
    }
  }
}
