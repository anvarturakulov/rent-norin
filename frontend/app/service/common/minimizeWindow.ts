import {
  Maindata,
  MinimizedWindow,
  MinimizedWindowType,
} from '@/app/context/app.context.interfaces';
import { DocumentModel } from '@/app/interfaces/document.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { Setting } from '@/app/interfaces/settings.interface';
import { UserModel } from '@/app/interfaces/user.interface';
import { Enterprise } from '@/app/interfaces/enterprise.interface';
import { clearSavedReportScroll } from './reportScrollPreservation';

type SetMainData = (key: string, value: unknown) => void;

function cloneData<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return [...value] as T;
  return { ...value } as T;
}

function upsertMinimized(mainData: Maindata, entry: MinimizedWindow, setMainData: SetMainData) {
  const list = mainData.minimizedWindows.filter((w) => w.id !== entry.id);
  setMainData('minimizedWindows', [...list, entry]);
}

function buildDocumentTitle(mainData: Maindata): string {
  const { contentTitle, isNewDocument, currentDocument } = mainData.document;
  const num = currentDocument.id;
  if (isNewDocument) return `${contentTitle} · янги`;
  return num ? `${contentTitle} · №${num}` : contentTitle;
}

function buildReferenceTitle(mainData: Maindata): string {
  const { isNewReference, currentReference } = mainData.reference;
  const { contentTitle } = mainData.document;
  const name = currentReference?.name?.trim();
  if (isNewReference) return `${contentTitle} · янги`;
  return name ? `${contentTitle}: ${name}` : contentTitle;
}

function buildSettingsTitle(mainData: Maindata): string {
  const { isNewSetting } = mainData.window;
  const setting = mainData.settings.currentSetting as Setting | undefined;
  if (isNewSetting) return 'Хусусият · янги';
  return setting?.key ? `Хусусият: ${setting.key}` : 'Хусусият';
}

function buildUserTitle(mainData: Maindata): string {
  const { isNewUser, currentUser } = mainData.users;
  if (isNewUser) return 'Фойдаланувчи · янги';
  const label = currentUser?.name || currentUser?.email;
  return label ? `Фойдаланувчи: ${label}` : 'Фойдаланувчи';
}

function buildEnterpriseTitle(mainData: Maindata): string {
  const { isNewEnterprise, currentEnterprise } = mainData.enterprises;
  if (isNewEnterprise) return 'Корхона · янги';
  const name = (currentEnterprise as Enterprise | undefined)?.name;
  return name ? `Корхона: ${name}` : 'Корхона';
}

function documentWindowId(mainData: Maindata): string {
  const { currentDocument, isNewDocument, contentName } = mainData.document;
  if (isNewDocument) return `document-new-${contentName}`;
  return `document-${currentDocument.id ?? 'unknown'}`;
}

function referenceWindowId(mainData: Maindata): string {
  const { currentReference, isNewReference } = mainData.reference;
  const { contentName } = mainData.document;
  if (isNewReference) return `reference-new-${contentName}`;
  return `reference-${currentReference?.id ?? 'unknown'}`;
}

export function minimizeDocument(mainData: Maindata, setMainData: SetMainData) {
  if (!mainData.document.showDocumentWindow) return;

  const entry: MinimizedWindow = {
    id: documentWindowId(mainData),
    type: 'document',
    title: buildDocumentTitle(mainData),
    contentType: mainData.document.contentType,
    contentName: mainData.document.contentName,
    contentTitle: mainData.document.contentTitle,
    isNew: mainData.document.isNewDocument,
    data: cloneData(mainData.document.currentDocument),
    minimizedAt: Date.now(),
    previousContentName: mainData.document.previousContentName,
    isDuplicateDraft: mainData.document.isDuplicateDraft,
    comeProductCalculationSignature: mainData.document.comeProductCalculationSignature,
  };

  upsertMinimized(mainData, entry, setMainData);
  setMainData('showDocumentWindow', false);
  setMainData('isNewDocument', false);
  setMainData('document.isDuplicateDraft', false);
  // Minimized docs should not pull report scroll back when closed later from taskbar
  clearSavedReportScroll();
}

export function minimizeReference(mainData: Maindata, setMainData: SetMainData) {
  if (!mainData.reference.showReferenceWindow) return;

  const entry: MinimizedWindow = {
    id: referenceWindowId(mainData),
    type: 'reference',
    title: buildReferenceTitle(mainData),
    contentType: 'reference',
    contentName: mainData.document.contentName,
    contentTitle: mainData.document.contentTitle,
    isNew: mainData.reference.isNewReference,
    data: cloneData(mainData.reference.currentReference),
    minimizedAt: Date.now(),
  };

  upsertMinimized(mainData, entry, setMainData);
  setMainData('showReferenceWindow', false);
  setMainData('isNewReference', false);
}

export function minimizeSettings(mainData: Maindata, setMainData: SetMainData) {
  if (!mainData.window.showSettingsWindow) return;

  const setting = mainData.settings.currentSetting;
  const entry: MinimizedWindow = {
    id: mainData.window.isNewSetting
      ? 'settings-new'
      : `settings-${(setting as Setting | undefined)?.id ?? 'unknown'}`,
    type: 'settings',
    title: buildSettingsTitle(mainData),
    contentType: 'servis',
    contentName: mainData.document.contentName,
    contentTitle: mainData.document.contentTitle,
    isNew: mainData.window.isNewSetting,
    data: cloneData(setting),
    minimizedAt: Date.now(),
  };

  upsertMinimized(mainData, entry, setMainData);
  setMainData('showSettingsWindow', false);
  setMainData('isNewSetting', false);
}

export function minimizeUser(mainData: Maindata, setMainData: SetMainData) {
  if (!mainData.users.showUserWindow) return;

  const user = mainData.users.currentUser;
  const entry: MinimizedWindow = {
    id: mainData.users.isNewUser
      ? 'user-new'
      : `user-${user?.id ?? 'unknown'}`,
    type: 'user',
    title: buildUserTitle(mainData),
    isNew: mainData.users.isNewUser,
    data: cloneData(user),
    minimizedAt: Date.now(),
  };

  upsertMinimized(mainData, entry, setMainData);
  setMainData('showUserWindow', false);
  setMainData('isNewUser', false);
}

export function minimizeEnterprise(mainData: Maindata, setMainData: SetMainData) {
  if (!mainData.enterprises.showEnterpriseWindow) return;

  const ent = mainData.enterprises.currentEnterprise as Enterprise | undefined;
  const entry: MinimizedWindow = {
    id: mainData.enterprises.isNewEnterprise
      ? 'enterprise-new'
      : `enterprise-${ent?.id ?? 'unknown'}`,
    type: 'enterprise',
    title: buildEnterpriseTitle(mainData),
    isNew: mainData.enterprises.isNewEnterprise,
    data: cloneData(ent),
    minimizedAt: Date.now(),
  };

  upsertMinimized(mainData, entry, setMainData);
  setMainData('showEnterpriseWindow', false);
  setMainData('isNewEnterprise', false);
}

function buildMinimizedEntryForOpenEditor(mainData: Maindata): MinimizedWindow | null {
  if (mainData.document.showDocumentWindow) {
    return {
      id: documentWindowId(mainData),
      type: 'document',
      title: buildDocumentTitle(mainData),
      contentType: mainData.document.contentType,
      contentName: mainData.document.contentName,
      contentTitle: mainData.document.contentTitle,
      isNew: mainData.document.isNewDocument,
      data: cloneData(mainData.document.currentDocument),
      minimizedAt: Date.now(),
      previousContentName: mainData.document.previousContentName,
      isDuplicateDraft: mainData.document.isDuplicateDraft,
      comeProductCalculationSignature: mainData.document.comeProductCalculationSignature,
    };
  }
  if (mainData.reference.showReferenceWindow) {
    return {
      id: referenceWindowId(mainData),
      type: 'reference',
      title: buildReferenceTitle(mainData),
      contentType: 'reference',
      contentName: mainData.document.contentName,
      contentTitle: mainData.document.contentTitle,
      isNew: mainData.reference.isNewReference,
      data: cloneData(mainData.reference.currentReference),
      minimizedAt: Date.now(),
    };
  }
  if (mainData.window.showSettingsWindow) {
    const setting = mainData.settings.currentSetting;
    return {
      id: mainData.window.isNewSetting
        ? 'settings-new'
        : `settings-${(setting as Setting | undefined)?.id ?? 'unknown'}`,
      type: 'settings',
      title: buildSettingsTitle(mainData),
      contentType: 'servis',
      contentName: mainData.document.contentName,
      contentTitle: mainData.document.contentTitle,
      isNew: mainData.window.isNewSetting,
      data: cloneData(setting),
      minimizedAt: Date.now(),
    };
  }
  if (mainData.users.showUserWindow) {
    const user = mainData.users.currentUser;
    return {
      id: mainData.users.isNewUser ? 'user-new' : `user-${user?.id ?? 'unknown'}`,
      type: 'user',
      title: buildUserTitle(mainData),
      isNew: mainData.users.isNewUser,
      data: cloneData(user),
      minimizedAt: Date.now(),
    };
  }
  if (mainData.enterprises.showEnterpriseWindow) {
    const ent = mainData.enterprises.currentEnterprise as Enterprise | undefined;
    return {
      id: mainData.enterprises.isNewEnterprise
        ? 'enterprise-new'
        : `enterprise-${ent?.id ?? 'unknown'}`,
      type: 'enterprise',
      title: buildEnterpriseTitle(mainData),
      isNew: mainData.enterprises.isNewEnterprise,
      data: cloneData(ent),
      minimizedAt: Date.now(),
    };
  }
  return null;
}

/** Свернуть любое сейчас открытое окно редактора (перед восстановлением другого). */
export function minimizeCurrentOpenEditor(mainData: Maindata, setMainData: SetMainData) {
  if (mainData.document.showDocumentWindow) minimizeDocument(mainData, setMainData);
  else if (mainData.reference.showReferenceWindow) minimizeReference(mainData, setMainData);
  else if (mainData.window.showSettingsWindow) minimizeSettings(mainData, setMainData);
  else if (mainData.users.showUserWindow) minimizeUser(mainData, setMainData);
  else if (mainData.enterprises.showEnterpriseWindow) minimizeEnterprise(mainData, setMainData);
}

function hideAllEditorFlags(setMainData: SetMainData) {
  setMainData('showDocumentWindow', false);
  setMainData('isNewDocument', false);
  setMainData('document.isDuplicateDraft', false);
  setMainData('showReferenceWindow', false);
  setMainData('isNewReference', false);
  setMainData('showSettingsWindow', false);
  setMainData('isNewSetting', false);
  setMainData('showUserWindow', false);
  setMainData('isNewUser', false);
  setMainData('showEnterpriseWindow', false);
  setMainData('isNewEnterprise', false);
}

export function autoMinimizeOpenEditors(mainData: Maindata, setMainData: SetMainData) {
  if (mainData.document.showDocumentWindow) minimizeDocument(mainData, setMainData);
  if (mainData.reference.showReferenceWindow) minimizeReference(mainData, setMainData);
  if (mainData.window.showSettingsWindow) minimizeSettings(mainData, setMainData);
  if (mainData.users.showUserWindow) minimizeUser(mainData, setMainData);
  if (mainData.enterprises.showEnterpriseWindow) minimizeEnterprise(mainData, setMainData);
}

/** Сброс активной карточки справочника при смене типа (свёрнутые окна сохраняют свою копию). */
export function resetReferenceEditorState(setMainData: SetMainData) {
  setMainData('currentReference', null);
  setMainData('showReferenceWindow', false);
  setMainData('isNewReference', false);
  setMainData('reference.inlineCreation', null);
  setMainData('reference.nestedInlineCreation', null);
  setMainData('reference.lastCreatedForInline', null);
}

export function closeMinimizedWindow(
  id: string,
  mainData: Maindata,
  setMainData: SetMainData,
) {
  setMainData(
    'minimizedWindows',
    mainData.minimizedWindows.filter((w) => w.id !== id),
  );
}

export function restoreWindow(
  win: MinimizedWindow,
  mainData: Maindata,
  setMainData: SetMainData,
) {
  let nextMinimized = mainData.minimizedWindows.filter((w) => w.id !== win.id);
  const openEntry = buildMinimizedEntryForOpenEditor(mainData);
  if (openEntry && openEntry.id !== win.id) {
    nextMinimized = [...nextMinimized.filter((w) => w.id !== openEntry.id), openEntry];
  }
  setMainData('minimizedWindows', nextMinimized);
  hideAllEditorFlags(setMainData);

  if (win.contentType) setMainData('contentType', win.contentType);
  if (win.contentName) setMainData('contentName', win.contentName);
  if (win.contentTitle) setMainData('contentTitle', win.contentTitle);
  if (win.contentType || win.contentName) setMainData('mainPage', false);

  switch (win.type as MinimizedWindowType) {
    case 'document': {
      setMainData('currentDocument', cloneData(win.data as DocumentModel));
      setMainData('showDocumentWindow', true);
      setMainData('isNewDocument', Boolean(win.isNew));
      if (win.previousContentName !== undefined) {
        setMainData('document.previousContentName', win.previousContentName);
      }
      if (win.isDuplicateDraft !== undefined) {
        setMainData('document.isDuplicateDraft', win.isDuplicateDraft);
      }
      if (win.comeProductCalculationSignature !== undefined) {
        setMainData(
          'document.comeProductCalculationSignature',
          win.comeProductCalculationSignature,
        );
      }
      break;
    }
    case 'reference': {
      setMainData('currentReference', cloneData(win.data as ReferenceModel));
      setMainData('showReferenceWindow', true);
      setMainData('isNewReference', Boolean(win.isNew));
      break;
    }
    case 'settings': {
      setMainData('currentSetting', cloneData(win.data));
      setMainData('showSettingsWindow', true);
      setMainData('isNewSetting', Boolean(win.isNew));
      break;
    }
    case 'user': {
      setMainData('currentUser', cloneData(win.data as UserModel));
      setMainData('showUserWindow', true);
      setMainData('isNewUser', Boolean(win.isNew));
      break;
    }
    case 'enterprise': {
      setMainData('currentEnterprise', cloneData(win.data));
      setMainData('showEnterpriseWindow', true);
      setMainData('isNewEnterprise', Boolean(win.isNew));
      break;
    }
  }
}
