import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { DetailedHTMLProps, HTMLAttributes } from "react";
import { KeyedMutator } from 'swr';
import { InlineCreationEntry, InlineCreationSlotKey } from '@/app/context/app.context.interfaces';

export interface ReferenceProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>,HTMLDivElement> {
    mutate?: KeyedMutator<ReferenceModel[]>;
    inlineMode?: boolean;
    typeReferenceOverride?: TypeReference;
    // В inline-режиме запись о создании передаётся явно (а не читается из глобального слота),
    // чтобы поддержать вложенные модалки (ТМЗ -> атрибут) без размонтирования родителя.
    inlineEntry?: InlineCreationEntry | null;
    inlineSlotKey?: InlineCreationSlotKey;
}