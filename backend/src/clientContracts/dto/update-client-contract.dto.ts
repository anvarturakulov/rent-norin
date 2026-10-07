import { PartialType } from "@nestjs/swagger";
import { CreateClientContractDto } from "./create-client-contract.dto";

export class UpdateClientContractDto extends PartialType(CreateClientContractDto) {}
