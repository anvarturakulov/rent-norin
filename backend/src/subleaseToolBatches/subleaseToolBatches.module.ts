import { forwardRef, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ReferencesModule } from "src/references/references.module";
import { SubleaseToolBatchConsumption } from "./subleaseToolBatchConsumption.model";
import { SubleaseToolOpenBatch } from "./subleaseToolOpenBatch.model";
import { SubleaseToolBatchesService } from "./subleaseToolBatches.service";

@Module({
  imports: [
    SequelizeModule.forFeature([
      SubleaseToolOpenBatch,
      SubleaseToolBatchConsumption,
    ]),
    // Cycle: ReferencesModule → … → DocumentsModule → SubleaseToolBatchesModule
    forwardRef(() => ReferencesModule),
  ],
  providers: [SubleaseToolBatchesService],
  exports: [SubleaseToolBatchesService],
})
export class SubleaseToolBatchesModule {}
