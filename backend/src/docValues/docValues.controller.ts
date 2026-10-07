import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Document } from "src/documents/document.model";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/auth/roles-auth.decorator";

@Controller("docvalues")
export class DocValuesController {}
