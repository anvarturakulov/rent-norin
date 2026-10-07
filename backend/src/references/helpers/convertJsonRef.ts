import { DocTableItemDto } from "src/documents/dto/docTableItem.dto";
import { DocValuesDto } from "src/documents/dto/docValues.dto";
import { UpdateCreateDocumentDto } from "src/documents/dto/updateCreateDocument.dto";
import { DocSTATUS } from "src/interfaces/document.interface";
import { UpdateCreateReferenceDto } from "../dto/updateCreateReference.dto";
import { RefValues } from "src/refvalues/refValues.model";
import { TypeSECTION } from "src/interfaces/reference.interface";
import { CreateReferenceValueDto } from "src/refvalues/dto/createReferenceValues.dto";

export const convertJsonRef = (jsonRow: any): UpdateCreateReferenceDto => {
  const refValues: CreateReferenceValueDto = {
    referenceId: 1,
    typePartners: jsonRow.typePartners,
    typeTMZ: jsonRow.typeTMZ,
    typeSection: TypeSECTION.COMMON,
    unit: jsonRow.unit,
    comment: jsonRow.comment,
    markToDeleted: jsonRow.deleted,
    norma: jsonRow.norma,
    longCharge: jsonRow.longCharge,
    shavkatCharge: jsonRow.shavkatCharge,
    firstPrice: jsonRow.firstPrice,
    secondPrice: jsonRow.secondPrice,
    thirdPrice: jsonRow.thirdPrice,
    telegramId: jsonRow.telegramId,
  };
  const idP = jsonRow._id.$oid.trim();
  const ref: UpdateCreateReferenceDto = {
    // oldId: idP,
    name: jsonRow.name,
    typeReference: jsonRow.typeReference,
    refValues: { ...refValues },
  };

  return ref;
};
